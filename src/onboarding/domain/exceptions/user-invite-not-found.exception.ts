import { DomainException } from "src/shared/domain.exception";

export class UserInviteNotFoundException extends DomainException {
  constructor(idOrToken: string) {
    super(`User invite with ID or token "${idOrToken}" not found.`);
  }
}

