import { DomainException } from 'src/shared/domain.exception';

export class InvalidIntervalException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

