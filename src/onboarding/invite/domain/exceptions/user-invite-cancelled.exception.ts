import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class UserInviteCancelledException extends DomainException {
  constructor() {
    super('User invite has been cancelled.');
  }
}

