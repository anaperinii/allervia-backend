import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { IUserAuthRepository } from '../../domain/repositories/user-auth.repository.interface';
import { AuthenticatedUserPayload } from '../../types/auth.types';
import { SwitchOrganizationDto } from '../dtos/switch-organization.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { TokenGeneratorFactory } from '../factories/token-generator.factory';

@Injectable()
export class SwitchOrganizationUseCase {
  constructor(
    private readonly userAuthRepository: IUserAuthRepository,
    private readonly tokenGeneratorFactory: TokenGeneratorFactory,
  ) {}

  async execute(
    dto: SwitchOrganizationDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<LoginResponseDto> {
    if (currentUser.type !== 'PATIENT' && currentUser.type !== 'SYSTEM_ADMIN' && currentUser.type !== 'ADMIN') {
      throw new BadRequestException('Troca de organização não permitida para este tipo de usuário');
    }

    const hasAccess = currentUser.memberships?.some(
      m => m.organizationId === dto.organizationId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado a esta organização');
    }

    const user = await this.userAuthRepository.findByEmailForAuth(currentUser.email);

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const tokenGenerator = this.tokenGeneratorFactory.create(user.type);
    return tokenGenerator.generate(user, dto.organizationId);
  }
}

