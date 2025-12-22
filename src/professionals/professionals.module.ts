import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ListProfessionalsUseCase } from './application/use-cases/list-professionals.use-case';
import { ListProfessionalsByOrganizationUseCase } from './application/use-cases/list-professionals-by-organization.use-case';
import { FindProfessionalByIdUseCase } from './application/use-cases/find-professional-by-id.use-case';
import { IProfessionalRepository } from './domain/professional.repository.interface';
import { ProfessionalPrismaRepository } from './infrastructure/persistence/prisma-professional.repository';
import { ProfessionalController } from './presentation/controllers/professional.controller';
import { AccountModule } from 'src/account/account.module';
import { UpdateUserBackofficeUseCase } from './application/use-cases/update-user-backoffice.use-case';
import { UpdateUserPersonalUseCase } from './application/use-cases/update-user-personal.use-case';
import { UpdateUserPersonalAdminUseCase } from './application/use-cases/update-user-personal-admin.use-case';

@Module({
  imports: [PrismaModule, AccountModule],
  providers: [
    // Use Cases
    ListProfessionalsUseCase,
    ListProfessionalsByOrganizationUseCase,
    FindProfessionalByIdUseCase,
    UpdateUserBackofficeUseCase,
    UpdateUserPersonalUseCase,
    UpdateUserPersonalAdminUseCase,

    // Repositories
    {
      provide: IProfessionalRepository,
      useClass: ProfessionalPrismaRepository,
    },
  ],
  controllers: [ProfessionalController],
  exports: [IProfessionalRepository, FindProfessionalByIdUseCase],
})
export class ProfessionalsModule {}
