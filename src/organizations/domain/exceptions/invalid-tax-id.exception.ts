import { DomainException } from "src/shared/domain.exception";

export class InvalidTaxIdException extends DomainException {
  constructor(message: string = 'Invalid tax ID provided.') {
    super(message);
  }
}



