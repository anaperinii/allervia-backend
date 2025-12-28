import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { AuthModule } from 'src/security/auth.module';
import { InviteController } from './controllers/invite.controller';
import { RegistrationController } from './controllers/registration.controller';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { CancelInviteUseCase } from './use-cases/cancel-invite.use-case';
import { ListInvitesUseCase } from './use-cases/list-invites.use-case';
import { InviteStrategyContext } from './strategies/invites/invite-strategy.context';
import { InviteStrategyFactory } from './strategies/invites/invite-strategy.factory';
import { IUserInviteRepository } from 'src/onboarding/domain/interfaces/user-invite.repository.interface';
import { PrismaUserInviteRepository } from 'src/onboarding/infrastructure/repositories/prisma-user-invite.repository';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { AdminInviteStrategy } from './strategies/invites/admin-invite.strategy';
import { SystemAdminInviteStrategy } from './strategies/invites/system-admin-invite.strategy';
import { FindInviteByIdUseCase } from './use-cases/find-invite-by-id.use-case';
import { FindInviteByOrgUseCase } from './use-cases/find-invite-by-org.use-case';
import { FindInviteByTokenUseCase } from './use-cases/find-invite-by-token.use-case';
import { ValidateInviteForRegisterUseCase } from './use-cases/validate-invite-for-registration.use-case';
import { FindActiveInviteUseCase } from './use-cases/find-active-invite.use-case';
import { AdminRegisterStrategy } from './strategies/register/admin-regiter.strategy';
import { ProfessionalRegisterStrategy } from './strategies/register/professional-register.strategy';
import { RegisterStrategyContext } from './strategies/register/register-strategy.context';
import { RegisterStrategyFactory } from './strategies/register/register-strategy.factory';

@Module({
  imports: [PrismaModule, AccountModule, AuthModule, OrganizationsModule],
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
    RegisterStrategyFactory,
    AdminInviteStrategy,
    AdminRegisterStrategy,
    SystemAdminInviteStrategy,
    ProfessionalRegisterStrategy,
 
    {
      provide: IUserInviteRepository,
      useClass: PrismaUserInviteRepository,
    },

  ],
  controllers: [InviteController, RegistrationController],
  exports: [IUserInviteRepository],
})
export class OnboardingModule {}
