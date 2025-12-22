import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class EmailInviteAlreadyActiveException extends DomainException {
  constructor() {
    super('There is an active user with this email address registered in this organization.');
  }
}
