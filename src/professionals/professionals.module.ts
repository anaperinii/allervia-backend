import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { ProfessionalRepository } from './professional.repository';
import { PrismaProfessionalRepository } from './prisma-professional.repository';
import { CreateProfessionalUseCase } from './use-cases/create-professional.use-case';
import { UpdateProfessionalUseCase } from './use-cases/update-professional.use-case';
import { FindProfessionalByIdUseCase } from './use-cases/find-professional-by-id.use-case';
import { FindProfessionalByUserUseCase } from './use-cases/find-professional-by-user.use-case';

@Module({
  imports: [PrismaModule],
  providers: [
    CreateProfessionalUseCase,
    UpdateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
    {
      provide: ProfessionalRepository,
      useClass: PrismaProfessionalRepository,
    },
  ],
  exports: [
    ProfessionalRepository,
    CreateProfessionalUseCase,
    UpdateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
  ],
})
export class ProfessionalsModule {}
