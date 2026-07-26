import { Injectable, NotFoundException } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { PasswordResetConfirmDTO } from '../dtos/password-reset-confirm.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { IPasswordHashingService } from '../interfaces/password-hashing.service.interface';
import { IEmailService } from 'src/infra/email/email.service';
import { AUTH_MESSAGES } from '../auth.messages';

@Injectable()
export class PasswordResetConfirmUseCase {
  constructor(
    private readonly authRepository: IUserAuthRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly emailService: IEmailService,
  ) {}

  async execute(dto: PasswordResetConfirmDTO): Promise<void> {
    const token = await this.authRepository.findActiveVerificationToken(
      SecurityUtil.sha256(dto.token),
      VerificationPurpose.PASSWORD_RESET,
    );

    if (!token) {
      throw new NotFoundException(AUTH_MESSAGES.invalidOrExpiredResetToken);
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.authRepository.finalizePasswordReset(
      token.id,
      token.userId,
      passwordHash,
    );

    await this.emailService.sendPasswordChangedNotification(token.userEmail);
  }
}
