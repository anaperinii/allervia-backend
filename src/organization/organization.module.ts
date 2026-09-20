import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuthModule } from 'src/security/auth.module';
import { FindOrganizationUseCase } from './use-cases/find-organization.use-case';
import { UpdateOrganizationUseCase } from './use-cases/update-organization.use-case';
import { OrganizationRepository } from './organization.repository';
import { PrismaOrganizationRepository } from './prisma-organization.repository';
import { OrganizationController } from './organization.controller';
import { ProvisioningController } from './provisioning/provisioning.controller';
import { ProvisioningGuard } from './provisioning/provisioning.guard';
import { ProvisionOrganizationUseCase } from './provisioning/provision-organization.use-case';

@Module({
  imports: [PrismaModule, ConfigModule, AuditModule, AuthModule],
  providers: [
    FindOrganizationUseCase,
    UpdateOrganizationUseCase,
    ProvisionOrganizationUseCase,
    ProvisioningGuard,
    {
      provide: OrganizationRepository,
      useClass: PrismaOrganizationRepository,
    },
  ],
  exports: [OrganizationRepository, FindOrganizationUseCase],
  controllers: [OrganizationController, ProvisioningController],
})
export class OrganizationModule {}
