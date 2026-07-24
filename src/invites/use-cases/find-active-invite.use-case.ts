import { Injectable } from '@nestjs/common';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';

@Injectable()
export class FindActiveInviteUseCase {
  constructor(private inviteRepository: IUserInviteRepository) {}

  async execute(email: string, organizationId: string) {
    return await this.inviteRepository.findActiveInvite(email, organizationId);
  }
}
