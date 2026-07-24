import { HttpStatus } from '@nestjs/common';
import { DomainException } from 'src/infra/exceptions/domain.exception';

export class DoseAlreadyArchivedException extends DomainException {
  constructor() {
    super('Dose já está arquivada.', HttpStatus.CONFLICT);
  }
}


