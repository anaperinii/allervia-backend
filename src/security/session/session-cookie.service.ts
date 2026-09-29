import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { createHash } from 'node:crypto';
import { SessionConfig } from './session.config';

@Injectable()
export class SessionCookieService {
  constructor(private readonly config: SessionConfig) {}

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/',
    };
  }

  set(response: Response, secret: string): void {
    response.cookie(this.config.cookieName, secret, this.baseOptions());
  }

  clear(response: Response): void {
    response.clearCookie(this.config.cookieName, this.baseOptions());
  }

  read(request: Request): string | null {
    const matches = (request.get('cookie') ?? '')
      .split(';')
      .filter((part) => part.trim().startsWith(this.config.cookieName + '='));
    if (matches.length > 1)
      throw new CodedUnauthorizedException(
        'SESSION_INVALID',
        'Credencial ambígua.',
      );
    const cookies = request.cookies as Record<string, string> | undefined;
    const value = cookies?.[this.config.cookieName];
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
      ? value
      : null;
  }

  describeDevice(request: Request): {
    userAgent: string | null;
    ipAddressHash: string | null;
  } {
    const userAgent = request.get('user-agent') ?? null;
    const ip = request.ip ?? null;

    return {
      userAgent: userAgent ? userAgent.slice(0, 255) : null,
      ipAddressHash: ip
        ? createHash('sha256').update(ip).digest('hex').slice(0, 32)
        : null,
    };
  }
}
