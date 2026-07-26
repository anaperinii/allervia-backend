import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CreateInviteDto } from 'src/invites/dtos/create-invite.dto';
import { InviteCreationStrategy } from './invite-creation-strategy';

@Injectable()
export class AdminInviteStrategy implements InviteCreationStrategy {
  validateAndGetOrganizationId(
    dtoInvite: CreateInviteDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<string> {
    return Promise.resolve(currentUser.organizationId);
  }
}
