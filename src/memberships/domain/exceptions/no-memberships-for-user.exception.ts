import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class NoMembershipsForUserException extends DomainException {
  constructor(userId: string) {
    super(`User with ID "${userId}" has no memberships.`);
  }
}

