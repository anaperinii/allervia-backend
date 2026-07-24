import { HttpStatus } from '@nestjs/common';
import { DomainException } from 'src/infra/exceptions/domain.exception';

export class UserInviteExpiredException extends DomainException {
  constructor() {
    super('O convite expirou.', HttpStatus.CONFLICT);
  }
}
