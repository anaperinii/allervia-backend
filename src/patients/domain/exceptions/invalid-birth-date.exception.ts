import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class InvalidBirthDateException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

