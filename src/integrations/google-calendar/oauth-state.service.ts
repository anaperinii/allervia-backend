import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
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
      !payload.organizationId
    ) {
      throw this.invalidState();
    }
    return payload;
  }

  private invalidState(): BadRequestException {
    return new BadRequestException('GOOGLE_OAUTH_STATE_INVALID');
  }
}
