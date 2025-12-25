import { DomainException } from "src/shared/domain.exception";

export class UserInviteAlreadyUsedException extends DomainException {
  constructor() {
    super('User invite has already been used.');
  }
}

