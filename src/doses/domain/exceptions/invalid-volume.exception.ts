import { DomainException } from 'src/shared/domain.exception';

export class InvalidVolumeException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}


