import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256 bits de CSPRNG codificados em base64url; nunca persistidos em claro. */
export function generateOpaqueSecret(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash do segredo guardado no banco. SHA-256 é suficiente aqui porque o valor
 * tem entropia total de CSPRNG: não há espaço de busca a proteger como em senha.
 */
export function hashOpaqueSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Comparação em tempo constante entre valores já normalizados. */
export function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Hash de identificadores usados em limite de tentativa, sem guardar o valor. */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Códigos de recuperação legíveis, exibidos uma vez e guardados por hash. */
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
