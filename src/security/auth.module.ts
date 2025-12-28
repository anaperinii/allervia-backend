import { Module } from '@nestjs/common';
import { JwtStrategy } from './infrastructure/jwt/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrganizationContextGuard } from './guards/organization-context.guard';
import { MembershipsModule } from 'src/memberships/memberships.module';
import { PrismaModule } from 'src/database/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { LoginUseCase } from './use-cases/login.use-case';
import { SwitchOrganizationUseCase } from './use-cases/switch-organization.use-case';
import { IPasswordHashingService } from './interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from './infrastructure/cryptography/bcrypt-password-hashing.service';
import { IJwtTokenService } from './interfaces/jwt-token.service.interface';
import { NestJwtTokenService } from './infrastructure/jwt/jwt-token.service';
import { IUserAuthRepository } from './interfaces/user-auth.repository.interface';
import { PrismaUserAuthRepository } from './infrastructure/repositories/prisma-user-auth.repository';
import { TokenGeneratorFactory } from './factories/token-generator.factory';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './controllers/auth.controller';
import { OrganizationContextFactory } from './factories/organization-context.factory';
import { RoleValidationFactory } from './factories/role-validation.factory';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ConfigModule,
    MembershipsModule,
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
    SwitchOrganizationUseCase,

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
    OrganizationContextGuard,
    RoleValidationFactory,
    OrganizationContextFactory,
  ],
  controllers: [AuthController],
  exports: [
    IJwtTokenService,
    IUserAuthRepository,
    IPasswordHashingService,
    OrganizationContextFactory,
    OrganizationContextGuard,
    RoleValidationFactory,
    RolesGuard,
  ],
})
export class AuthModule {}
