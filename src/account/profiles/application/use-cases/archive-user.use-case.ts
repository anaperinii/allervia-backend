import { Injectable } from "@nestjs/common";
import { IUserRepository } from "src/account/profiles/domain/contracts/user.repository.interface";
import { User } from "src/account/profiles/domain/entities/user.entity";
import { UserNotFoundException } from "src/account/profiles/domain/exceptions/user-not-found.exception";
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

@Injectable()
export class ArchiveUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(id: string, currentUser: AuthenticatedUserPayload): Promise<User> {

    const user = await this.userRepository.findUserById(id, currentUser.activeOrgId);

    if (!user) {
      throw new UserNotFoundException(id);
    }

    user.archive();

    return this.userRepository.update(user);
  }
}
