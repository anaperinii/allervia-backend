import { DomainException } from 'src/shared/domain.exception';

export class InvalidDoseStatusException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

