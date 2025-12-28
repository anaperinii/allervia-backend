import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { CreateOrganizationUseCase } from './use-cases/create-organization.use-case';
import { FindOrganizationUseCase } from './use-cases/find-organization.use-case';
import { IOrganizationRepository } from './domain/interfaces/organization.repository.interface';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-organization.repository';
import { OrganizationsController } from './controllers/organizations.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    // Use Cases
    CreateOrganizationUseCase,
    FindOrganizationUseCase,

    // Repositories
    {
      provide: IOrganizationRepository,
      useClass: PrismaOrganizationRepository,
    },
  ],
  exports: [IOrganizationRepository, FindOrganizationUseCase],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}

