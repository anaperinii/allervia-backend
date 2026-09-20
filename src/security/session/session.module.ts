import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuthModule } from '../auth.module';
import { AuthPolicyModule } from '../auth-policy.module';
import { IAuthSessionRepository } from './auth-session.repository';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { PrismaAuthSessionRepository } from './prisma-auth-session.repository';
import { SecretBoxService } from './secret-box.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionController } from './session.controller';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import { TotpService } from './totp.service';
import { ReauthenticateUseCase } from './use-cases/reauthenticate.use-case';
import { StartSessionUseCase } from './use-cases/start-session.use-case';
import { VerifyMfaChallengeUseCase } from './use-cases/verify-mfa-challenge.use-case';

/**
 * Sessão opaca do navegador, CSRF e segundo fator. O módulo de autenticação
 * legado continua existindo para o bearer mapeado; os dois compartilham o mesmo
 * guard, que aplica as mesmas verificações de revogação e MFA.
 */
@Module({
  imports: [PrismaModule, ConfigModule, AuthPolicyModule, AuthModule],
  providers: [
    SessionCookieService,
    CsrfService,
    SecretBoxService,
    TotpService,
    MfaService,
    SessionService,
    AuthRateLimitService,
    StartSessionUseCase,
    VerifyMfaChallengeUseCase,
    ReauthenticateUseCase,
    SessionAuthGuard,
    CsrfGuard,
    {
      provide: IAuthSessionRepository,
      useClass: PrismaAuthSessionRepository,
    },
  ],
  controllers: [SessionController],
  exports: [
    AuthPolicyModule,
    SessionService,
    SessionCookieService,
    CsrfService,
    MfaService,
    SessionAuthGuard,
    CsrfGuard,
    IAuthSessionRepository,
  ],
})
export class SessionModule {}
