import { Injectable } from '@nestjs/common';
import { FindInviteByTokenUseCase } from './find-invite-by-token.use-case';

@Injectable()
export class ValidateInviteForRegisterUseCase {
  constructor(private findInviteByToken: FindInviteByTokenUseCase) {}

  async execute(token: string) {
    const invite = await this.findInviteByToken.execute(token);
    invite.validateForUse();
    return invite;
  }
}
