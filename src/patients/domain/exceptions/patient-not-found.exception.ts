import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class PatientNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Paciente com ID "${id}" não encontrado.`);
  }
}

