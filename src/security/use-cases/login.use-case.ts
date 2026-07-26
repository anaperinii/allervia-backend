import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { IUserAuthRepository } from 'src/security/interfaces/user-auth.repository.interface';
import { LoginDto } from 'src/security/dtos/login.dto';
import { LoginResponseDto } from 'src/security/dtos/login-response.dto';
import { TokenGeneratorFactory } from 'src/security/factories/token-generator.factory';
import { AUTH_MESSAGES } from 'src/security/auth.messages';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userAuthRepository: IUserAuthRepository,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly tokenGeneratorFactory: TokenGeneratorFactory,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userAuthRepository.findByEmailForAuth(dto.email);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    }

    const isValid = await this.passwordHashing.compare(
      dto.password,
      user.password,
    );

    if (!isValid) {
      throw new UnauthorizedException(AUTH_MESSAGES.invalidCredentials);
    }

    const tokenGenerator = this.tokenGeneratorFactory.create(user.type);
    return tokenGenerator.generate(user);
  }
}
