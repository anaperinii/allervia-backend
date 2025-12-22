import { DomainException } from 'src/shared/domain/exceptions/domain.exception';

export class DoseNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Dose com ID "${id}" não encontrada.`);
  }
}

