import { DomainException } from "src/shared/domain.exception";

export class UserInviteCancelledException extends DomainException {
  constructor() {
    super('User invite has been cancelled.');
  }
}

