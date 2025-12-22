import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class InactiveRoleException extends DomainException {
  constructor(name: string) {
    super(`Role with name "${name}" is inactive.`);
  }
}

