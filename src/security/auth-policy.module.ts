import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionConfig } from './session/session.config';

@Module({
  imports: [ConfigModule],
  providers: [SessionConfig],
  exports: [SessionConfig],
})
export class AuthPolicyModule {}
