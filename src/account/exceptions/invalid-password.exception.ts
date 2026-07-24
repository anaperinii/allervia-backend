import { DomainException } from 'src/infra/exceptions/domain.exception';

export class InvalidPasswordException extends DomainException {
  constructor(message: string = 'Invalid password provided.') {
    super(message);
  }
}
