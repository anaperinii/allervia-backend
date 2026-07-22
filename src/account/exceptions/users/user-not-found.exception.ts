import { DomainException } from "src/shared/domain.exception";

export class UserNotFoundException extends DomainException {
  constructor(id: string) {
    super(`User with ID "${id}" not found.`);
  }
}

