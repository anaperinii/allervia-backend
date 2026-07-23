import { HttpStatus } from '@nestjs/common';
import { DomainException } from 'src/shared/domain.exception';

export class DoseAlreadyArchivedException extends DomainException {
  constructor() {
    super('Dose já está arquivada.', HttpStatus.CONFLICT);
  }
}


