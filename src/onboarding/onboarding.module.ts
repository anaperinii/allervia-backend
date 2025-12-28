import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { AuthModule } from 'src/security/auth.module';
import { InviteController } from './invite/presentation/invite.controller';
import { RegistrationController } from './register/presentation/registration.controller';
import { CreateInviteUseCase } from './invite/application/use-cases/create-invite.use-case';
import { CancelInviteUseCase } from './invite/application/use-cases/cancel-invite.use-case';
import { ListInvitesUseCase } from './invite/application/use-cases/list-invites.use-case';
import { InviteStrategyContext } from './invite/application/strategies/invite-strategy.context';
import { InviteStrategyFactory } from './invite/application/strategies/invite-strategy.factory';
import { RegisterStrategyContext } from './register/application/strategies/register-strategy.context';
import { RegisterStrategyFactory } from './register/application/strategies/register-strategy.factory';
import { IUserInviteRepository } from 'src/onboarding/invite/domain/contracts/user-invite.repository.interface';
import { PrismaUserInviteRepository } from 'src/onboarding/invite/infrastructure/persistence/prisma-user-invite.repository';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { AdminInviteStrategy } from './invite/application/strategies/admin-invite.strategy';
import { SystemAdminInviteStrategy } from './invite/application/strategies/system-admin-invite.strategy';
import { ProfessionalRegisterStrategy } from './register/application/strategies/professional-register.strategy';
import { AdminRegisterStrategy } from './register/application/strategies/admin-regiter.strategy';
import { FindInviteByIdUseCase } from './invite/application/use-cases/find-invite-by-id.use-case';
import { FindInviteByOrgUseCase } from './invite/application/use-cases/find-invite-by-org.use-case';
import { FindInviteByTokenUseCase } from './invite/application/use-cases/find-invite-by-token.use-case';
import { ValidateInviteForRegisterUseCase } from './invite/application/use-cases/validate-invite-for-registration.use-case';
import { FindActiveInviteUseCase } from './invite/application/use-cases/find-active-invite.use-case';

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
