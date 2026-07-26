import { createHash, randomBytes } from 'crypto';

export class SecurityUtil {
  static generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  static sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
