import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class UserInviteExpiredException extends DomainException {
  constructor() {
    super('User invite has expired.');
  }
}

