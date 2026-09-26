import { Injectable } from '@nestjs/common';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { IUserAuthRepository } from 'src/security/interfaces/user-auth.repository.interface';
import { LoginDto } from 'src/security/dtos/login.dto';
import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { TokenGeneratorFactory } from 'src/security/factories/token-generator.factory';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from 'src/security/auth.messages';
import { SessionConfig } from 'src/security/session/session.config';
import {
  CodedForbiddenException,
  CodedUnauthorizedException,
} from 'src/infra/exceptions/coded.exception';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userAuthRepository: IUserAuthRepository,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly tokenGeneratorFactory: TokenGeneratorFactory,
    private readonly sessionConfig: SessionConfig,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResponseDto> {
    if (this.sessionConfig.legacyBearer === 'disabled') {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.legacyBearerDisabled,
        AUTH_MESSAGES.legacyBearerDisabled,
      );
    }

    const user = await this.userAuthRepository.findByEmailForAuth(dto.email);

    if (!user) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    const isValid = await this.passwordHashing.compare(
      dto.password,
      user.password,
    );

    if (!isValid) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.invalidCredentials,
        AUTH_MESSAGES.invalidCredentials,
      );
    }

    const secondFactorRequired =
      (await this.userAuthRepository.hasConfirmedMfaCredential(user.id)) ||
      (this.sessionConfig.mfaEnforcement === 'required' &&
        user.professionalId !== null);

    if (secondFactorRequired) {
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.mfaRequired,
        AUTH_MESSAGES.legacyBearerSecondFactorRequired,
      );
    }

    const tokenGenerator = this.tokenGeneratorFactory.create(user.type);
    return tokenGenerator.generate(user);
  }
}
