import { Module } from '@nestjs/common';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { EmailModule } from 'src/infra/email/email.module';
import { AuthModule } from 'src/security/auth.module';
import { SessionModule } from 'src/security/session/session.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { GoogleCalendarModule } from 'src/integrations/google-calendar/google-calendar.module';
import { ProfessionalsModule } from 'src/professionals/professionals.module';
import { AccountController } from './account.controller';
import { GetAccountContextUseCase } from './use-cases/get-account-context.use-case';
import { FindUserByIdUseCase } from './use-cases/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { UserAccessModule } from './user-access.module';
import { ArchiveUserUseCase } from './use-cases/archive-user.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { IUserRepository } from './user.repository';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    AuditModule,
    AuthModule,
    SessionModule,
    PermissionsModule,
    GoogleCalendarModule,
    UserAccessModule,
    ProfessionalsModule,
  ],
  providers: [
    FindUserByIdUseCase,
    GetAccountContextUseCase,
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ChangePasswordUseCase,

    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  controllers: [AccountController],
  exports: [IUserRepository, FindUserByIdUseCase],
})
export class AccountModule {}
