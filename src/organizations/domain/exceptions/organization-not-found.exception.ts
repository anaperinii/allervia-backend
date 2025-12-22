import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class OrganizationNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Organization with ID "${id}" not found.`);
  }
}

