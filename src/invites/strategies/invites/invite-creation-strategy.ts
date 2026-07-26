import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { CreateInviteDto } from 'src/invites/dtos/create-invite.dto';

export interface InviteCreationStrategy {
  validateAndGetOrganizationId(
    dto: CreateInviteDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<string>;
}
