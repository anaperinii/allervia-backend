import { DomainException } from "src/shared/domain.exception";

export class RoleAlreadyExistsException extends DomainException {
  constructor(name: string) {
    super(`Role with name "${name}" already exists.`);
  }
}

