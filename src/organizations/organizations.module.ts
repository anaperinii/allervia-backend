import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrganizationsController } from './presentation/controllers/organizations.controller';
import { CreateOrganizationUseCase } from './application/use-cases/create-organization.use-case';
import { FindOrganizationUseCase } from './application/use-cases/find-organization.use-case';
import { IOrganizationRepository } from './domain/repositories/organization.repository.interface';
import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository';

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

