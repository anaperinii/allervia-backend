import { Injectable } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { PasswordResetRequestDTO } from '../dtos/password-reset-request.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { IEmailService } from 'src/infra/email/email.service';

const RESET_TOKEN_TTL_MINUTES = 10;

// Throttle de emissão em camadas (janela deslizante).
const EMISSION_LIMITS = [
  { windowSeconds: 60, max: 1 },
  { windowSeconds: 15 * 60, max: 3 },
  { windowSeconds: 60 * 60, max: 5 },
];

@Injectable()
export class PasswordResetRequestUseCase {
  constructor(
    private readonly authRepository: IUserAuthRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(requestDto: PasswordResetRequestDTO): Promise<void> {
    const user = await this.authRepository.findByEmailForAuth(requestDto.email);

    if (!user) {
      return;
    }

    if (await this.isThrottled(user.id)) {
      return;
    }

    const token = SecurityUtil.generateSecureToken();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESET_TOKEN_TTL_MINUTES);

    await this.authRepository.createVerificationToken({
      userId: user.id,
      purpose: VerificationPurpose.PASSWORD_RESET,
      tokenHash: SecurityUtil.sha256(token),
      expiresAt,
    });

    await this.emailService.sendPasswordResetLink(user.email, token);
  }

  private async isThrottled(userId: string): Promise<boolean> {
    for (const limit of EMISSION_LIMITS) {
      const since = new Date(Date.now() - limit.windowSeconds * 1000);
      const count = await this.authRepository.countRecentVerificationTokens(
        userId,
        VerificationPurpose.PASSWORD_RESET,
        since,
      );
      if (count >= limit.max) {
        return true;
      }
    }
    return false;
  }
}
