import { Injectable, NotFoundException } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { EmailChangeVerifyDTO } from '../dtos/email-change-verify.dto';
import { SecurityUtil } from 'src/utils/security.utils';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { AUTH_MESSAGES } from '../auth.messages';

@Injectable()
export class EmailChangeVerifyUseCase {
  constructor(private readonly authRepository: IUserAuthRepository) {}

  async execute(
    dto: EmailChangeVerifyDTO,
  ): Promise<{ valid: true; newEmail: string }> {
    const token = await this.authRepository.findActiveVerificationToken(
      SecurityUtil.sha256(dto.token),
      VerificationPurpose.EMAIL_CHANGE,
      true,
    );

    if (!token || !token.newEmail) {
      throw new NotFoundException(
        AUTH_MESSAGES.invalidOrExpiredEmailChangeToken,
      );
    }

    return { valid: true, newEmail: token.newEmail };
  }
}
