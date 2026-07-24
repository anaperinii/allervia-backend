import { Injectable } from '@nestjs/common';
import { ValidateInviteForRegisterUseCase } from 'src/invites/use-cases/validate-invite-for-registration.use-case';
import { RegisterUser } from '../../domain/interfaces/register.interface';
import { ProfileInternalUserDto } from 'src/account/dtos/users/profile-internal-user.dto';
import { InternalUserRegisterStrategy } from './internal-user-register.strategy';

@Injectable()
export class RegisterStrategyContext {
  constructor(
    private strategy: InternalUserRegisterStrategy,
    private validateInviteForRegistration: ValidateInviteForRegisterUseCase,
  ) {}

  async registerInternalUserFromInvite(
    inviteToken: string,
    dto: ProfileInternalUserDto,
  ): Promise<RegisterUser> {
    const invite =
      await this.validateInviteForRegistration.execute(inviteToken);

    return this.strategy.registerInternalUserFromInvite(invite, dto);
  }
}
