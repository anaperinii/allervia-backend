import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ListInvitesQueryDto } from '../dtos/list-invites-query.dto';
import { FindInviteByOrgUseCase } from './find-invite-by-org.use-case';
import { FindUserByIdUseCase } from 'src/account/application/use-cases/find-user-by-id.use-case';

@Injectable()
export class ListInvitesUseCase {
  constructor(
    private findInviteByOrgUseCase: FindInviteByOrgUseCase,
    private findUserById: FindUserByIdUseCase,
  ) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: ListInvitesQueryDto
  ) {
    const organizationId = currentUser.activeOrgId;

    const invites = await this.findInviteByOrgUseCase.execute(organizationId, {
      roleType: query.roleType,
      onlyActive: query.onlyActive ?? false,
      includeExpired: query.includeExpired ?? false
    });

    const result = await Promise.all(
      invites.map(async (invite) => {
        const createdByUser = await this.findUserById.execute(
          invite.createdById,
          currentUser
        );

        return {
          ...invite,
          createdById: createdByUser.id,
          createdByName: createdByUser.fullName,
          createdByEmail: createdByUser.email,
        }
      }),
    );

    return result;
  }
}