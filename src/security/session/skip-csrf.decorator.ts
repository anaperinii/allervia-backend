import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skip_csrf';

/**
 * Isenta um endpoint da verificação CSRF. Reservado para consumidores que não
 * usam credencial de ambiente — webhooks autenticados por assinatura própria e
 * integrações com credencial dedicada. Nunca usar em rota de navegador.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
