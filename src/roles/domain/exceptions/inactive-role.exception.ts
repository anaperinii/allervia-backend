import { DomainException } from "src/shared/domain.exception";

export class InactiveRoleException extends DomainException {
  constructor(name: string) {
    super(`Role with name "${name}" is inactive.`);
  }
}

