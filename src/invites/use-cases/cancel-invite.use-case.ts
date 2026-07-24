import { Injectable } from '@nestjs/common';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindInviteByIdUseCase } from './find-invite-by-id.use-case';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { InviteResponseDto } from 'src/invites/dtos/invite-response.dto';

@Injectable()
export class CancelInviteUseCase {
  constructor(
    private findInviteByIdUseCase: FindInviteByIdUseCase,
    private inviteRepository: IUserInviteRepository
  ) {}

  async execute(
    inviteId: string,
    currentUser: AuthenticatedUserPayload
  ): Promise<InviteResponseDto> {
    const invite = await this.findInviteByIdUseCase.execute(inviteId, currentUser);

    invite.deactive();
    
    await this.inviteRepository.update(invite);

    return invite;
  }
}