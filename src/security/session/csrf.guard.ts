import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CodedForbiddenException,
  CodedHttpException,
} from 'src/infra/exceptions/coded.exception';
import { HttpStatus } from '@nestjs/common';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { SKIP_CSRF_KEY } from './skip-csrf.decorator';
import { CSRF_HEADER, CsrfService } from './csrf.service';
import { SessionConfig } from './session.config';
import { SessionService } from './session.service';
import { RequestWithSession } from './session-auth.guard';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ACCEPTED_CONTENT_TYPES = ['application/json'];

/**
 * Proteção de comandos contra requisições forjadas. Cookies são enviados pelo
 * navegador automaticamente, então todo método mutante autenticado por cookie
 * precisa apresentar o token sincronizador e uma origem aceitável. CORS não
 * substitui esta verificação.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly csrf: CsrfService,
    private readonly sessionService: SessionService,
    private readonly config: SessionConfig,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithSession>();

    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (skip) return true;

    this.assertContentType(request);
    this.assertOrigin(request);

    const presented = request.get(CSRF_HEADER) ?? undefined;
    const session = request.authSession;

    if (session) {
      if (
        !presented ||
        !this.sessionService.validateCsrfToken(session, presented)
      ) {
        throw new CodedForbiddenException(
          AUTH_ERROR_CODES.csrfInvalid,
          AUTH_MESSAGES.csrfTokenMissing,
        );
      }
      return true;
    }

    // Sem nenhum cookie a credencial não é ambiente: um consumidor de API com
    // bearer, ou uma operação administrativa por chave, não pode ser disparado
    // por um site terceiro em nome da vítima. Nesses casos a defesa é a
    // verificação de origem acima.
    if (!this.csrfCookiePresent(request)) return true;

    if (!this.csrf.validate(request, presented)) {
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.csrfInvalid,
        AUTH_MESSAGES.csrfTokenMissing,
      );
    }

    return true;
  }

  private csrfCookiePresent(request: RequestWithSession): boolean {
    const cookies = request.cookies as Record<string, string> | undefined;
    return Boolean(cookies?.[this.csrf.cookieName]);
  }

  /**
   * Comandos JSON não aceitam tipos que um formulário entre origens consegue
   * enviar sem preflight.
   */
  private assertContentType(request: RequestWithSession): void {
    const contentType = request.get('content-type');
    if (!contentType) return;

    const normalized = contentType.split(';')[0].trim().toLowerCase();
    if (ACCEPTED_CONTENT_TYPES.includes(normalized)) return;

    throw new CodedHttpException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      AUTH_ERROR_CODES.unsupportedContentType,
      AUTH_MESSAGES.unsupportedContentType,
    );
  }

  /**
   * `Origin` ausente é tratado por classe de cliente: cliente com cookie
   * precisa declarar origem; consumidor de API por bearer não envia o header.
   */
  private assertOrigin(request: RequestWithSession): void {
    const origin = request.get('origin');

    if (!origin) {
      const hasCookieCredential =
        Boolean(request.authSession) || this.csrfCookiePresent(request);
      if (!hasCookieCredential) return;
      throw new CodedForbiddenException(
        AUTH_ERROR_CODES.originNotAllowed,
        AUTH_MESSAGES.originNotAllowed,
      );
    }

    if (this.isAllowedOrigin(request, origin)) return;

    throw new CodedForbiddenException(
      AUTH_ERROR_CODES.originNotAllowed,
      AUTH_MESSAGES.originNotAllowed,
    );
  }

  private isAllowedOrigin(
    request: RequestWithSession,
    origin: string,
  ): boolean {
    const allowed = this.config.allowedOrigins;
    if (allowed.includes(origin)) return true;

    const host = request.get('host');
    if (!host) return false;

    // Mesma origem: UI e API ficam atrás do mesmo gateway.
    const sameOrigin = [`https://${host}`, `http://${host}`];
    return sameOrigin.includes(origin);
  }
}
