import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './security/auth.module';
import { RequestIdMiddleware } from './infra/http/request-id.middleware';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SessionModule } from './security/session/session.module';
import { SessionAuthGuard } from './security/session/session-auth.guard';
import { CsrfGuard } from './security/session/csrf.guard';
import { HttpErrorFilter } from './infra/filters/http-error.filter';
import { PatientsModule } from './patients/patients.module';
import { PoliciesGuard } from './security/guards/policies.guard';
import { OrganizationModule } from './organization/organization.module';
import { InvitesModule } from './invites/invites.module';
import { AccountModule } from './account/account.module';
import { TreatmentProtocolsModule } from './treatment-protocols/treatment-protocols.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { PermissionsModule } from './security/permissions/permissions.module';
import { AuditTrailModule } from './audit/audit-trail.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PublicRequestsModule } from './public-requests/public-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    SessionModule,
    PatientsModule,
    OrganizationModule,
    InvitesModule,
    AccountModule,
    TreatmentProtocolsModule,
    ProfessionalsModule,
    PermissionsModule,
    AuditTrailModule,
    SchedulingModule,
    NotificationsModule,
    PublicRequestsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter,
    },
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
