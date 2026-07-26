import { Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { EmailModule } from 'src/infra/email/email.module';
import { AuthController } from './auth.controller';
import { LoginUseCase } from './use-cases/login.use-case';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IPasswordHashingService } from './interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from './bcrypt-password-hashing.service';
import { IJwtTokenService } from './interfaces/jwt-token.service.interface';
import { NestJwtTokenService } from './jwt-token.service';
import { RolesGuard } from './guards/roles.guard';
import { RoleValidationFactory } from './factories/role-validation.factory';
import { IUserAuthRepository } from './interfaces/user-auth.repository.interface';
import { PrismaUserAuthRepository } from './prisma-user-auth.repository';
import { TokenGeneratorFactory } from './factories/token-generator.factory';
import { PasswordResetRequestUseCase } from './use-cases/password-reset-request.use-case';
import { PasswordResetVerifyUseCase } from './use-cases/password-reset-verify.use-case';
import { PasswordResetConfirmUseCase } from './use-cases/password-reset-confirm.use-case';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  providers: [
    LoginUseCase,
    PasswordResetRequestUseCase,
    PasswordResetVerifyUseCase,
    PasswordResetConfirmUseCase,
    {
      provide: IPasswordHashingService,
      useClass: BcryptPasswordHashingService,
    },
    {
      provide: IJwtTokenService,
      useClass: NestJwtTokenService,
    },
    {
      provide: IUserAuthRepository,
      useClass: PrismaUserAuthRepository,
    },
    TokenGeneratorFactory,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    RoleValidationFactory,
  ],
  controllers: [AuthController],
  exports: [
    IJwtTokenService,
    IPasswordHashingService,
    JwtAuthGuard,
    RolesGuard,
    RoleValidationFactory,
  ],
})
export class AuthModule {}
