import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IPasswordHashingService } from '../interfaces/password-hashing.service.interface';
import { IJwtTokenService } from '../interfaces/jwt-token.service.interface';
import { IUserAuthRepository } from '../interfaces/user-auth.repository.interface';
import { LoginDto } from '../dtos/login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { TokenGeneratorFactory } from '../factories/token-generator.factory';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userAuthRepository: IUserAuthRepository,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly jwtTokenService: IJwtTokenService,
    private readonly tokenGeneratorFactory: TokenGeneratorFactory,
  ) {}

  async execute(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userAuthRepository.findByEmailForAuth(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isValid = await this.passwordHashing.compare(dto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokenGenerator = this.tokenGeneratorFactory.create(user.type);
    return await tokenGenerator.generate(user, dto.activeOrgId);
  }
}


