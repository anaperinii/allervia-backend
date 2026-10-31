import { Module } from '@nestjs/common';
import { UserAccessModule } from 'src/account/user-access.module';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { SessionModule } from 'src/security/session/session.module';
import { ProfessionalRepository } from './professional.repository';
import { PrismaProfessionalRepository } from './prisma-professional.repository';
import { ProfessionalsController } from './professionals.controller';
import { CreateProfessionalUseCase } from './use-cases/create-professional.use-case';
import { FindProfessionalByIdUseCase } from './use-cases/find-professional-by-id.use-case';
import { FindProfessionalByUserUseCase } from './use-cases/find-professional-by-user.use-case';
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case';
import { UpdateTeamMemberUseCase } from './use-cases/update-team-member.use-case';
import { UpdateMemberAccessUseCase } from './use-cases/update-member-access.use-case';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from 'src/infra/email/email.module';
import { AuthModule } from 'src/security/auth.module';
import { EmailChangeDispatcherService } from './email-change-dispatcher.service';
import { RequestEmailChangeUseCase } from './use-cases/request-email-change.use-case';
import { ApproveEmailChangeUseCase } from './use-cases/approve-email-change.use-case';
import { RejectEmailChangeUseCase } from './use-cases/reject-email-change.use-case';
import { ListEmailChangeRequestsUseCase } from './use-cases/list-email-change-requests.use-case';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    SessionModule,
    UserAccessModule,
    ConfigModule,
    EmailModule,
    AuthModule,
  ],
  providers: [
    CreateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
    ListTeamMembersUseCase,
    UpdateTeamMemberUseCase,
    UpdateMemberAccessUseCase,
    EmailChangeDispatcherService,
    RequestEmailChangeUseCase,
    ApproveEmailChangeUseCase,
    RejectEmailChangeUseCase,
    ListEmailChangeRequestsUseCase,
    {
      provide: ProfessionalRepository,
      useClass: PrismaProfessionalRepository,
    },
  ],
  controllers: [ProfessionalsController],
  exports: [
    ProfessionalRepository,
    CreateProfessionalUseCase,
    FindProfessionalByIdUseCase,
    FindProfessionalByUserUseCase,
    RequestEmailChangeUseCase,
  ],
})
export class ProfessionalsModule {}
