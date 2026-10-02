import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { GoogleCalendarConfig } from './google-calendar.config';

export interface SealedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

@Injectable()
export class GoogleTokenBoxService {
  constructor(private readonly config: GoogleCalendarConfig) {}

  get available(): boolean {
    return this.config.tokenEncryptionKey !== null;
  }

  seal(plaintext: string): SealedToken {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyVersion: 1,
    };
  }

  open(sealed: SealedToken): string {
    const key = this.requireKey();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(sealed.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private requireKey(): Buffer {
    const key = this.config.tokenEncryptionKey;
    if (!key) {
      throw new ServiceUnavailableException('GOOGLE_TOKEN_KEY_UNAVAILABLE');
    }
    return key;
  }
}
