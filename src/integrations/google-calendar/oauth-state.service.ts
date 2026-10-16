import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { GoogleCalendarConfig } from './google-calendar.config';
import { GoogleTokenBoxService } from './google-token-box.service';

export interface OAuthStatePayload {
  userId: string;
  professionalId: string;
  organizationId: string;
  nonce: string;
  exp: number;
}

@Injectable()
export class OAuthStateService {
  constructor(
    private readonly config: GoogleCalendarConfig,
    private readonly tokenBox: GoogleTokenBoxService,
    private readonly prisma: PrismaService,
  ) {}

  seal(input: Omit<OAuthStatePayload, 'nonce' | 'exp'>): string {
    const payload: OAuthStatePayload = {
      ...input,
      nonce: randomBytes(16).toString('hex'),
      exp: Date.now() + this.config.oauthStateTtlMs,
    };
    const sealed = this.tokenBox.seal(JSON.stringify(payload));
    return Buffer.from(JSON.stringify(sealed), 'utf8').toString('base64url');
  }

  open(state: string): OAuthStatePayload {
    let payload: OAuthStatePayload;
    try {
      const sealed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as Parameters<GoogleTokenBoxService['open']>[0];
      payload = JSON.parse(this.tokenBox.open(sealed)) as OAuthStatePayload;
    } catch {
      throw this.invalidState();
    }
    if (
      !payload ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now() ||
      !payload.userId ||
      !payload.professionalId ||
      !payload.organizationId ||
      typeof payload.nonce !== 'string' ||
      !payload.nonce
    ) {
      throw this.invalidState();
    }
    return payload;
  }

  async consume(payload: OAuthStatePayload): Promise<void> {
    await this.prisma.oAuthStateNonce.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    try {
      await this.prisma.oAuthStateNonce.create({
        data: { nonce: payload.nonce, expiresAt: new Date(payload.exp) },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.invalidState();
      }
      throw error;
    }
  }

  private invalidState(): BadRequestException {
    return new BadRequestException('GOOGLE_OAUTH_STATE_INVALID');
  }
}
