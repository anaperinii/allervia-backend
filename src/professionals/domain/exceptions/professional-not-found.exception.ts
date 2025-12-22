import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class ProfessionalNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Professional with ID "${id}" not found.`);
  }
}

