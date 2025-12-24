import { DomainException } from "src/shared/domain.exception";

export class InvalidPasswordException extends DomainException {
  constructor(message: string = 'Invalid password provided.') {
    super(message);
  }
}

