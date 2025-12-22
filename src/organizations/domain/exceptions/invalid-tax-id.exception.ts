import { DomainException } from "src/shared/domain/exceptions/domain.exception";

export class InvalidTaxIdException extends DomainException {
  constructor(message: string = 'Invalid tax ID provided.') {
    super(message);
  }
}

