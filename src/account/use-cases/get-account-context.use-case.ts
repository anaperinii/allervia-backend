import { Injectable, NotFoundException } from '@nestjs/common';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { listCapabilities } from 'src/security/permissions/ability/capabilities';
import { AccountContextDto } from 'src/account/dtos/account-context.dto';
import { IUserRepository } from 'src/account/user.repository';
import { USER_MESSAGES } from 'src/account/user.messages';

export interface AccountContextRequest {
  userId: string;
  /** Verdadeiro quando a requisição chegou pela sessão do navegador. */
  sessionBased: boolean;
  mfaRequired: boolean;
}

/**
 * Identidade, contexto organizacional e capacidades do usuário autenticado.
 * Monta a resposta a partir de uma seleção pública explícita — o registro cru
 * do banco nunca é devolvido.
 */
@Injectable()
export class GetAccountContextUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(request: AccountContextRequest): Promise<AccountContextDto> {
    const profile = await this.userRepository.findAccountProfile(
      request.userId,
    );

    if (!profile) {
      throw new NotFoundException(USER_MESSAGES.notFound(request.userId));
    }

    const organizationId = profile.organization?.id ?? '';
    const ability = this.abilityFactory.createForUser({
      id: profile.user.id,
      organizationId,
      professionalId: profile.professional?.id ?? null,
      roles: profile.roles,
    });

    return {
      user: profile.user,
      professional: profile.professional,
      organization: profile.organization,
      roles: profile.roles,
      capabilities: listCapabilities(ability),
      security: {
        mfaEnabled: profile.hasConfirmedMfa,
        mfaRequired: request.mfaRequired,
        sessionBased: request.sessionBased,
      },
    };
  }
}
