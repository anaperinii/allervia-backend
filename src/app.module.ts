import { Module } from '@nestjs/common';
import { AuthModule } from './security/auth.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './security/guards/jwt-auth.guard';
import { PatientsModule } from './patients/patients.module';
import { PoliciesGuard } from './security/guards/policies.guard';
import { OrganizationModule } from './organization/organization.module';
import { InvitesModule } from './invites/invites.module';
import { AccountModule } from './account/account.module';
import { TreatmentProtocolsModule } from './treatment-protocols/treatment-protocols.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { PermissionsModule } from './security/permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // torna as variáveis de ambiente disponíveis globalmente
    }),
    AuthModule,
    PatientsModule,
    OrganizationModule,
    InvitesModule,
    AccountModule,
    TreatmentProtocolsModule,
    ProfessionalsModule,
    PermissionsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
})
export class AppModule {}
