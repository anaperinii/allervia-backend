import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { ORGANIZATION_MESSAGES } from '../organization.messages';

export const PROVISIONING_HEADER = 'x-provisioning-key';

/** Chave curta demais não protege nada; recusar é melhor que fingir controle. */
const MINIMUM_KEY_LENGTH = 24;

/**
 * Provisionamento é operação administrativa da plataforma, não uma jornada do
 * produto. A chave viaja em header — nunca no corpo, na URL ou no bundle do
 * navegador — e a rota fica indisponível enquanto não estiver configurada.
 */
@Injectable()
export class ProvisioningGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SUPER_ADMIN_REGISTRATION_KEY');

    if (!expected || expected.trim().length < MINIMUM_KEY_LENGTH) {
      throw new ServiceUnavailableException(
        ORGANIZATION_MESSAGES.provisioningUnavailable,
      );
    }

    const presented = context
      .switchToHttp()
      .getRequest<Request>()
      .get(PROVISIONING_HEADER);

    if (!presented || !this.matches(presented, expected)) {
      throw new CodedUnauthorizedException(
        'PROVISIONING_KEY_INVALID',
        ORGANIZATION_MESSAGES.provisioningKeyInvalid,
      );
    }

    return true;
  }

  private matches(presented: string, expected: string): boolean {
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
