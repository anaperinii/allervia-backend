import { Module } from '@nestjs/common';
import { AuthModule } from './security/auth.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './security/guards/jwt-auth.guard';
import { MembershipsModule } from './memberships/memberships.module';
import { PatientsModule } from './patients/patients.module';
import { ImmunotherapiesModule } from './immunotherapies/immunotherapies.module';
import { DosesModule } from './doses/doses.module';
import { OrganizationContextGuard } from './security/guards/organization-context.guard';
import { RolesGuard } from './security/guards/roles.guard';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesModule } from './roles/roles.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AccountModule } from './account/account.module';
import { AdministrationModule } from './administration/administration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // torna as variáveis de ambiente disponíveis globalmente
    }),
    AuthModule,
    PrismaModule,
    MembershipsModule,
    PatientsModule,
    ImmunotherapiesModule,
    DosesModule,
    OrganizationsModule,
    RolesModule,
    ProfessionalsModule,
    OnboardingModule,
    AccountModule,
    AdministrationModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
