import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SessionConfig } from './session.config';
import { AUTH_MESSAGES } from '../auth.messages';

export interface SealedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

/**
 * Criptografia autenticada para segredos que precisam ser lidos de volta, como
 * o segredo TOTP. A chave fica fora do banco (`MFA_ENCRYPTION_KEY`, 32 bytes em
 * base64); sem ela o cadastro de segundo fator fica indisponível em vez de
 * gravar material sensível em claro.
 */
@Injectable()
export class SecretBoxService {
  constructor(private readonly config: SessionConfig) {}

  get available(): boolean {
    return this.config.mfaEncryptionKey !== null;
  }

  seal(plaintext: string): SealedSecret {
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

  open(sealed: SealedSecret): string {
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
    const key = this.config.mfaEncryptionKey;
    if (!key) {
      throw new ServiceUnavailableException(AUTH_MESSAGES.mfaKeyUnavailable);
    }
    return key;
  }
}
