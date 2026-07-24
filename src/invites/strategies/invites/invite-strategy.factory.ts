import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { InviteCreationStrategy } from './invite-creation-strategy';
import { AdminInviteStrategy } from './admin-invite.strategy';

@Injectable()
export class InviteStrategyFactory {
  constructor(private adminStrategy: AdminInviteStrategy) {}

  getStrategy(currentUser: AuthenticatedUserPayload): InviteCreationStrategy {
    if (currentUser.type === 'PROFESSIONAL') {
      return this.adminStrategy;
    }

    throw new BadRequestException(
      'Tipo de usuário não autorizado para gerar convites',
    );
  }
}
