import { DomainException } from 'src/shared/domain.exception';

export class RoleInUseException extends DomainException {
  constructor(roleName: string) {
    super(`Role "${roleName}" cannot be deleted because it has active users or is currently active.`);
  }
}

