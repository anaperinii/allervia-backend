import { Injectable } from '@nestjs/common';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { UserInvite } from 'src/invites/domain/entities/user-invite.entity';
import { FindInvitesFilters } from 'src/invites/domain/interfaces/invite.interface';

@Injectable()
export class FindInviteByOrgUseCase {
  constructor(private inviteRepository: IUserInviteRepository) {}

  async execute(
    organizationId: string,
    filters: FindInvitesFilters = {},
  ): Promise<UserInvite[]> {
    return this.inviteRepository.findByOrganization(organizationId, filters);
  }
}
