import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { AuthModule } from 'src/security/auth.module';
import { InviteController } from './invite.controller';
import { RegistrationController } from './registration.controller';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { CancelInviteUseCase } from './use-cases/cancel-invite.use-case';
import { ListInvitesUseCase } from './use-cases/list-invites.use-case';
import { InviteStrategyContext } from './strategies/invites/invite-strategy.context';
import { InviteStrategyFactory } from './strategies/invites/invite-strategy.factory';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { PrismaUserInviteRepository } from 'src/invites/prisma-user-invite.repository';
import { AdminInviteStrategy } from './strategies/invites/admin-invite.strategy';
import { FindInviteByIdUseCase } from './use-cases/find-invite-by-id.use-case';
import { FindInviteByOrgUseCase } from './use-cases/find-invite-by-org.use-case';
import { FindInviteByTokenUseCase } from './use-cases/find-invite-by-token.use-case';
import { ValidateInviteForRegisterUseCase } from './use-cases/validate-invite-for-registration.use-case';
import { FindActiveInviteUseCase } from './use-cases/find-active-invite.use-case';
import { RegisterStrategyContext } from './strategies/register/register-strategy.context';
import { InternalUserRegisterStrategy } from './strategies/register/internal-user-register.strategy';
import { ProfessionalsModule } from 'src/professionals/professionals.module';

@Module({
  imports: [
    PrismaModule,
    AccountModule,
    PermissionsModule,
    AuthModule,
    ProfessionalsModule,
  ],
  providers: [
    // Use Cases
    CreateInviteUseCase,
    CancelInviteUseCase,
    ListInvitesUseCase,
    FindInviteByIdUseCase,
    FindInviteByOrgUseCase,
    FindInviteByTokenUseCase,
    ValidateInviteForRegisterUseCase,
    FindActiveInviteUseCase,

    // Strategies
    InviteStrategyContext,
    InviteStrategyFactory,
    RegisterStrategyContext,
    InternalUserRegisterStrategy,
    AdminInviteStrategy,

    {
      provide: IUserInviteRepository,
      useClass: PrismaUserInviteRepository,
    },

  ],
  controllers: [InviteController, RegistrationController],
  exports: [IUserInviteRepository],
})
export class InvitesModule {}
