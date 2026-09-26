import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
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
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[this.config.cookieName] ?? null;
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
