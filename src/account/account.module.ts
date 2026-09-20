import { Module } from '@nestjs/common';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { EmailModule } from 'src/infra/email/email.module';
import { AuthModule } from 'src/security/auth.module';
import { SessionModule } from 'src/security/session/session.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { AccountController } from './account.controller';
import { GetAccountContextUseCase } from './use-cases/get-account-context.use-case';
import { FindUserByIdUseCase } from './use-cases/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { ArchiveUserUseCase } from './use-cases/archive-user.use-case';
import { ValidateUserEmailUseCase } from './use-cases/validate-user-email.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { IUserRepository } from './user.repository';
import { ProfileInternalUserDto } from './dtos/profile-internal-user.dto';
import { ProfileSystemUserDto } from './dtos/profile-system-user.dto';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { UserResponseDto } from './dtos/user-response.dto';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    AuditModule,
    AuthModule,
    SessionModule,
    PermissionsModule,
  ],
  providers: [
    FindUserByIdUseCase,
    GetAccountContextUseCase,
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ValidateUserEmailUseCase,
    ChangePasswordUseCase,

    UserResponseDto,
    UpdateUserStatusDto,
    ProfileInternalUserDto,
    ProfileSystemUserDto,

    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  controllers: [AccountController],
  exports: [IUserRepository, FindUserByIdUseCase, ValidateUserEmailUseCase],
})
export class AccountModule {}
