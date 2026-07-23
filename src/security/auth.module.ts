import { Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaModule } from 'src/database/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { LoginUseCase } from './use-cases/login.use-case';
import { IPasswordHashingService } from './interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from './bcrypt-password-hashing.service';
import { IJwtTokenService } from './interfaces/jwt-token.service.interface';
import { NestJwtTokenService } from './jwt-token.service';
import { IUserAuthRepository } from './interfaces/user-auth.repository.interface';
import { PrismaUserAuthRepository } from './prisma-user-auth.repository';
import { TokenGeneratorFactory } from './factories/token-generator.factory';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './auth.controller';
import { RoleValidationFactory } from './factories/role-validation.factory';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ConfigModule,
    AccountModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  providers: [
    // Use Cases
    LoginUseCase,

    // Services
    {
      provide: IPasswordHashingService,
      useClass: BcryptPasswordHashingService,
    },
    {
      provide: IJwtTokenService,
      useClass: NestJwtTokenService,
    },

    // Repositories
    {
      provide: IUserAuthRepository,
      useClass: PrismaUserAuthRepository,
    },

    // Factories
    TokenGeneratorFactory,

    // Guards & Strategies
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    RoleValidationFactory,
  ],
  controllers: [AuthController],
  exports: [
    IJwtTokenService,
    IUserAuthRepository,
    IPasswordHashingService,
    RoleValidationFactory,
    RolesGuard,
  ],
})
export class AuthModule {}
