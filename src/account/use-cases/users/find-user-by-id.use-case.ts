import { BadRequestException, Injectable } from '@nestjs/common';
import { IUserRepository } from '../../user.repository';
import { UserResponseDto } from '../../dtos/users/user-response.dto';
import { UserNotFoundException } from '../../exceptions/users/user-not-found.exception';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(
    userId: string,
    currentUser: AuthenticatedUserPayload,
    tx?: ITransactionContext,
  ): Promise<UserResponseDto> {
    //SYSTEM_ADMIN tem acesso global — busca sem restrição de organização
    if (currentUser?.type === 'SYSTEM_ADMIN') {
      const user = await this.userRepository.findUserSystemById(userId, tx);

      if (!user) {
        throw new UserNotFoundException(userId);
      }

      return user;
    }

    if (!currentUser.activeOrgId) {
      throw new BadRequestException('Contexto organizacional não identificado');
    }

    // Busca com scoping por organização
    const user = await this.userRepository.findUserById(userId, currentUser.activeOrgId, tx);

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    return user;
  }
}