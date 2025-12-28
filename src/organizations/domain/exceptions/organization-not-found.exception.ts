import { DomainException } from "src/shared/domain.exception";

export class OrganizationNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Organization with ID "${id}" not found.`);
  }
}


