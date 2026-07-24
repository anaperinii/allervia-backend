import { HttpStatus } from '@nestjs/common';
import { DomainException } from 'src/infra/exceptions/domain.exception';

export class InvalidDoseStatusException extends DomainException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

