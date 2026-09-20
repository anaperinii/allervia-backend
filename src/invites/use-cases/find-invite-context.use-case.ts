import { Injectable, NotFoundException } from '@nestjs/common';
import { IUserInviteRepository } from 'src/invites/domain/interfaces/user-invite.repository.interface';
import { InviteContextDto } from 'src/invites/dtos/invite-response.dto';
import { INVITE_MESSAGES } from 'src/invites/invite.messages';

/**
 * Contexto do convite para a tela de cadastro. Quem apresenta o token já
 * recebeu o e-mail; ainda assim a resposta traz o mínimo, e convite expirado,
 * cancelado ou já usado não abre o formulário.
 */
@Injectable()
export class FindInviteContextUseCase {
  constructor(private readonly inviteRepository: IUserInviteRepository) {}

  async execute(token: string): Promise<InviteContextDto> {
    const context = await this.inviteRepository.findContextByToken(token);

    if (!context) {
      throw new NotFoundException(INVITE_MESSAGES.notFound(token));
    }

    const invite = await this.inviteRepository.findByToken(token);
    invite?.validateForUse();

    return context;
  }
}
