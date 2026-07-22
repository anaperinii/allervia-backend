import { DomainException } from "src/shared/domain.exception";

export class OrganizationAlreadyExistsException extends DomainException {
  constructor(field: string, value: string) {
    super(`Organization with ${field} "${value}" already exists.`);
  }
}



