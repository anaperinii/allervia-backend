import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class InvalidWeightException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

