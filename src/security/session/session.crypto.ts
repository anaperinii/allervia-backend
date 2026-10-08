import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateOpaqueSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let code = '';
  for (let index = 0; index < bytes.length; index += 1) {
    if (index === 5) code += '-';
    code += alphabet[bytes[index] % alphabet.length];
  }
  return code;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
