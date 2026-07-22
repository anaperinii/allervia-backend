import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { CreateOrganizationUseCase } from './use-cases/create-organization.use-case';
import { FindOrganizationUseCase } from './use-cases/find-organization.use-case';
import { OrganizationRepository } from './organization.repository';
import { PrismaOrganizationRepository } from './prisma-organization.repository';
import { OrganizationController } from './organization.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    CreateOrganizationUseCase,
    FindOrganizationUseCase,
    {
      provide: OrganizationRepository,
      useClass: PrismaOrganizationRepository,
    },
  ],
  exports: [OrganizationRepository, FindOrganizationUseCase],
  controllers: [OrganizationController],
})
export class OrganizationModule {}

