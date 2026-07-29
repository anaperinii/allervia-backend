import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'authenticated_only';

/**
 * Marca uma rota que exige apenas autenticação (sem autorização por policy) —
 * ex.: rotas "self", onde o usuário age na própria conta. Torna a intenção
 * explícita para o PoliciesGuard, que por padrão nega rotas sem policy.
 */
export const AuthenticatedOnly = () =>
  SetMetadata(AUTHENTICATED_ONLY_KEY, true);
