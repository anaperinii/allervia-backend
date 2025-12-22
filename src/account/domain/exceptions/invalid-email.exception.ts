import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class InvalidEmailException extends DomainException {
  constructor(message: string = 'Invalid email provided.') {
    super(message);
  }
}

