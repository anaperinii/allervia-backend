import { HttpStatus } from "@nestjs/common";
import { DomainException } from "src/shared/domain.exception";

export class UserInviteAlreadyUsedException extends DomainException {
  constructor() {
    super('O convite já foi utilizado.', HttpStatus.CONFLICT);
  }
}

