import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class PatientAlreadyArchivedException extends DomainException {
  constructor() {
    super('Paciente já está arquivado.');
  }
}

