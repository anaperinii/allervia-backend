import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class InvalidSpecialtyException extends DomainException {
  constructor(message: string = 'Invalid specialty provided.') {
    super(message);
  }
}

