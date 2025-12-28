import { DomainException } from 'src/shared/domain.exception';

export class PatientAlreadyArchivedException extends DomainException {
  constructor() {
    super('Paciente já está arquivado.');
  }
}


