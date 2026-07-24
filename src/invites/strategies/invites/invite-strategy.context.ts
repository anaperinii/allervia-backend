import { Injectable } from '@nestjs/common';
import { InviteCreationStrategy } from './invite-creation-strategy';
import { InviteStrategyFactory } from './invite-strategy.factory';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { CreateInviteDto } from 'src/invites/dtos/create-invite.dto';

@Injectable()
export class InviteStrategyContext {
  private strategy: InviteCreationStrategy;

  constructor(private strategyFactory: InviteStrategyFactory) {}

  private setStrategyForUser(currentUser: AuthenticatedUserPayload) {
    this.strategy = this.strategyFactory.getStrategy(currentUser);
  }

  async validateAndGetOrganizationId(
    dtoInvite: CreateInviteDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<string> {
    this.setStrategyForUser(currentUser);
    if (!this.strategy) {
      throw new Error('Strategy not set.');
    }

    return this.strategy.validateAndGetOrganizationId(dtoInvite, currentUser);
  }
}
