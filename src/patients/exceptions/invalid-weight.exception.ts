import { DomainException } from 'src/shared/domain.exception';

export class InvalidWeightException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}



