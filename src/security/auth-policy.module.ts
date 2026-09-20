import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionConfig } from './session/session.config';

/**
 * Política de autenticação compartilhada. Fica em um módulo próprio para que o
 * login legado e o módulo de sessão leiam os mesmos limites sem dependência
 * circular entre eles.
 */
@Module({
  imports: [ConfigModule],
  providers: [SessionConfig],
  exports: [SessionConfig],
})
export class AuthPolicyModule {}
