import { DomainException } from "src/shared/domain.exception";

export class UserInviteExpiredException extends DomainException {
  constructor() {
    super('User invite has expired.');
  }
}

