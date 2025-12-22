import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class DoseAlreadyArchivedException extends DomainException {
  constructor() {
    super('Dose já está arquivada.');
  }
}

