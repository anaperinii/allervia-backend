import { Module } from '@nestjs/common';
import { AuthModule } from './security/auth.module';
import { PrismaModule } from './database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './security/guards/jwt-auth.guard';
import { PatientsModule } from './patients/patients.module';
import { OrganizationContextGuard } from './security/guards/organization-context.guard';
import { RolesGuard } from './security/guards/roles.guard';
import { OrganizationModule } from './organization/organization.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AccountModule } from './account/account.module';
import { TreatmentProtocolsModule } from './treatment-protocols/treatment-protocols.module';
import { ProfessionalsModule } from './professionals/professionals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // torna as variáveis de ambiente disponíveis globalmente
    }),
    AuthModule,
    PatientsModule,
    OrganizationModule,
    OnboardingModule,
    AccountModule,
    TreatmentProtocolsModule,
    ProfessionalsModule,
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
