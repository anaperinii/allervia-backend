import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { SessionConfig } from './session.config';
import { generateOpaqueSecret, safeEquals } from './session.crypto';

const SECURE_COOKIE_NAME = '__Host-allervia_csrf';
const INSECURE_COOKIE_NAME = 'allervia_csrf';

export const CSRF_HEADER = 'x-csrf-token';

/**
 * Desafio anti-CSRF de pré-sessão, para os comandos que ainda não têm sessão
 * clínica (login, MFA, recuperação de senha). Depois do login, o token
 * sincronizador vinculado à sessão assume o papel.
 */
@Injectable()
export class CsrfService {
  constructor(private readonly config: SessionConfig) {}

  get cookieName(): string {
    return this.config.secureCookies
      ? SECURE_COOKIE_NAME
      : INSECURE_COOKIE_NAME;
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.preAuthChallengeTtlMs,
    };
  }

  issue(response: Response): string {
    const token = generateOpaqueSecret();
    response.cookie(this.cookieName, token, this.options());
    return token;
  }

  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.options();
    response.clearCookie(this.cookieName, options);
  }

  /** Double submit: o header precisa repetir o valor do cookie de pré-sessão. */
  validate(request: Request, presented: string | undefined): boolean {
    if (!presented) return false;
    const cookies = request.cookies as Record<string, string> | undefined;
    const stored = cookies?.[this.cookieName];
    if (!stored) return false;
    return safeEquals(stored, presented);
  }
}
