import { DomainException } from 'src/shared/domain.exception';

export class ImmunotherapyNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Imunoterapia com ID "${id}" não encontrada.`);
  }
}


