import { DomainException } from 'src/shared/domain.exception';

export class InvalidTargetVolumeException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

