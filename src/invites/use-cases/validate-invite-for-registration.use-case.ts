import { Injectable } from '@nestjs/common';
import { FindInviteByTokenUseCase } from './find-invite-by-token.use-case';

/**
 * Valida o convite antes do cadastro. As exceções de domínio já carregam
 * status e código estáveis (`USER_INVITE_EXPIRED`, `USER_INVITE_ALREADY_USED`,
 * `USER_INVITE_CANCELLED`); convertê-las em texto apagaria a distinção que a
 * interface precisa para orientar o convidado.
 */
@Injectable()
export class ValidateInviteForRegisterUseCase {
  constructor(private findInviteByToken: FindInviteByTokenUseCase) {}

  async execute(token: string) {
    const invite = await this.findInviteByToken.execute(token);
    invite.validateForUse();
    return invite;
  }
}
