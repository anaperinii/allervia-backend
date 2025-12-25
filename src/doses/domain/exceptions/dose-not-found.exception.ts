import { DomainException } from 'src/shared/domain.exception';

export class DoseNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Dose com ID "${id}" não encontrada.`);
  }
}

