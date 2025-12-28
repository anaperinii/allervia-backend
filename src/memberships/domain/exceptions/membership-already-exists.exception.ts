import { DomainException } from "src/shared/domain.exception";

export class MembershipAlreadyExistsException extends DomainException {
  constructor(userId: string, organizationId: string) {
    super(`Membership for user "${userId}" in organization "${organizationId}" already exists.`);
  }
}


