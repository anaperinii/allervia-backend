import { HttpStatus } from "@nestjs/common";
import { DomainException } from "src/shared/domain.exception";

export class UserInviteExpiredException extends DomainException {
  constructor() {
    super('O convite expirou.', HttpStatus.CONFLICT);
  }
}

