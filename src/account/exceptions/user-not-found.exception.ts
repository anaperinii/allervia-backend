import { DomainException } from 'src/infra/exceptions/domain.exception';

export class UserNotFoundException extends DomainException {
  constructor(id: string) {
    super(`User with ID "${id}" not found.`);
  }
}
