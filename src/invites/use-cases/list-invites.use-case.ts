import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ListInvitesQueryDto } from 'src/invites/dtos/list-invites-query.dto';
import {
  InviteResponseDto,
  resolveInviteStatus,
} from 'src/invites/dtos/invite-response.dto';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { buildPage, PageDto, resolvePage } from 'src/infra/http/pagination';

@Injectable()
export class ListInvitesUseCase {
  constructor(private readonly inviteRepository: IUserInviteRepository) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: ListInvitesQueryDto,
  ): Promise<PageDto<InviteResponseDto>> {
    const bounds = resolvePage(query);

    const { items, total } = await this.inviteRepository.findPageByOrganization(
      currentUser.organizationId,
      {
        role: query.role,
        onlyActive: query.onlyActive ?? false,
        includeExpired: query.includeExpired ?? false,
        search: query.search?.trim() || undefined,
      },
      bounds,
    );

    return buildPage(
      items.map((invite) => ({
        id: invite.id,
        email: invite.email,
        fullName: invite.fullName,
        role: invite.role,
        status: resolveInviteStatus(invite),
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        createdAt: invite.createdAt,
        createdBy: invite.createdBy,
      })),
      total,
      bounds,
    );
  }
}
