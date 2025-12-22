import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class UserInviteAlreadyUsedException extends DomainException {
  constructor() {
    super('User invite has already been used.');
  }
}

