import { DomainException } from 'src/shared/domain.exception';

export class InvalidBirthDateException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

