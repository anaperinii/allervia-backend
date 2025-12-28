import { DomainException } from "src/shared/domain.exception";

export class MembershipNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Membership with ID "${id}" not found.`);
  }
}


