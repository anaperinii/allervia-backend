import { BadRequestException, Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/contracts/user.repository.interface';
import { UserResponseDto } from '../dtos/user-response.dto';
import { UserNotFoundException } from '../../domain/exceptions/user-not-found.exception';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';

@Injectable()
export class FindUserByIdUseCase {
  constructor(
    private userRepository: IUserRepository,
  ) {}

  async execute(
    userId: string,
    currentUser?: AuthenticatedUserPayload,
    activeOrgId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserResponseDto> {

    const organizationId = currentUser ? currentUser.activeOrgId : activeOrgId;

    if (currentUser && currentUser.type === 'SYSTEM_ADMIN') {
      const systemUser = await this.userRepository.findUserSystemById(userId);

      if (!systemUser) {
      throw new UserNotFoundException(userId);
      }

      return systemUser;
    }

    if (!organizationId) {
       // Se o Admin chegar aqui sem OrgId, ele trava logo aqui
       throw new BadRequestException('Contexto organizacional não identificado');
    }

    // 3. Busca restrita por Organização
    const user = await this.userRepository.findUserById(userId, organizationId, tx);

    if (!user) {
      const systemUser = await this.userRepository.findUserSystemById(userId);

      if (!systemUser) {
        throw new UserNotFoundException(userId);
      }

      return systemUser;
    }

    return user;
  }
}

