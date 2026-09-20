import { Module } from '@nestjs/common';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { SessionModule } from 'src/security/session/session.module';
import { ProfessionalRepository } from './professional.repository';
import { PrismaProfessionalRepository } from './prisma-professional.repository';
import { ProfessionalsController } from './professionals.controller';
import { CreateProfessionalUseCase } from './use-cases/create-professional.use-case';
import { UpdateProfessionalUseCase } from './use-cases/update-professional.use-case';
import { FindProfessionalByIdUseCase } from './use-cases/find-professional-by-id.use-case';
import { FindProfessionalByUserUseCase } from './use-cases/find-professional-by-user.use-case';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';
import { UpdateTeamMemberUseCase } from './use-cases/update-team-member.use-case';
import { UpdateMemberAccessUseCase } from './use-cases/update-member-access.use-case';

@Module({
  imports: [PrismaModule, AuditModule, SessionModule],
  providers: [
    CreateProfessionalUseCase,
    UpdateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
    ListTeamMembersUseCase,
    UpdateTeamMemberUseCase,
    UpdateMemberAccessUseCase,
    {
      provide: ProfessionalRepository,
      useClass: PrismaProfessionalRepository,
    },
  ],
  controllers: [ProfessionalsController],
  exports: [
    ProfessionalRepository,
    CreateProfessionalUseCase,
    UpdateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
  ],
})
export class ProfessionalsModule {}
