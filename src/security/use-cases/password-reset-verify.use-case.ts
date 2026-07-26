import { Injectable, NotFoundException } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { PasswordResetVerifyDTO } from '../dtos/password-reset-verify.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { AUTH_MESSAGES } from '../auth.messages';

@Injectable()
export class PasswordResetVerifyUseCase {
  constructor(private readonly authRepository: IUserAuthRepository) {}

  async execute(dto: PasswordResetVerifyDTO): Promise<{ valid: true }> {
    const token = await this.authRepository.findActiveVerificationToken(
      SecurityUtil.sha256(dto.token),
      VerificationPurpose.PASSWORD_RESET,
    );

    if (!token) {
      throw new NotFoundException(AUTH_MESSAGES.invalidOrExpiredResetToken);
    }

    return { valid: true };
  }
}
