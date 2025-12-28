import { DomainException } from "src/shared/domain.exception";

export class RoleNotFoundException extends DomainException {
  constructor(idOrName: string) {
    super(`Role with ID or name "${idOrName}" not found.`);
  }
}
