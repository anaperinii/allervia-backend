import { BadRequestException, Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/contracts/user.repository.interface';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UserNotFoundException } from '../../domain/exceptions/user-not-found.exception';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(
    userId: string,
    currentUser?: AuthenticatedUserPayload,
    activeOrgId?: string,
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

    // Usuários comuns precisam de contexto organizacional
    const organizationId = currentUser ? currentUser.activeOrgId : activeOrgId;

    if (!organizationId) {
      throw new BadRequestException('Contexto organizacional não identificado');
    }

    // Busca com scoping por organização
    const user = await this.userRepository.findUserById(userId, organizationId, tx);

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    return user;
  }
}