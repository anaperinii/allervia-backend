import { Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { UserNotFoundException } from "src/account/exceptions/users/user-not-found.exception";
import { IUserRepository } from "src/account/user.repository";
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
