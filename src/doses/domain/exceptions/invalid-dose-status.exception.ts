import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class InvalidDoseStatusException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

