import { HttpStatus } from "@nestjs/common";
import { DomainException } from "src/infra/exceptions/domain.exception";

export class UserInviteCancelledException extends DomainException {
  constructor() {
    super('O convite foi cancelado.', HttpStatus.CONFLICT);
  }
}

