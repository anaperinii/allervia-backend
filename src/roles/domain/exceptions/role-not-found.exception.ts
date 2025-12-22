import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class RoleNotFoundException extends DomainException {
  constructor(idOrName: string) {
    super(`Role with ID or name "${idOrName}" not found.`);
  }
}
