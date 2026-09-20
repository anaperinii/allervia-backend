import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';

const PERIOD_SECONDS = 30;
/** Tolerância de um passo para cada lado, cobrindo relógios levemente fora. */
const EPOCH_TOLERANCE_SECONDS = PERIOD_SECONDS;

export interface TotpVerification {
  valid: boolean;
  /** Passo de tempo aceito; guardá-lo impede o reuso do mesmo código. */
  timeStep: number | null;
}

/**
 * Segundo fator TOTP (RFC 6238) sobre biblioteca mantida, sem criptografia
 * própria. A proteção contra replay usa o passo de tempo devolvido pela
 * verificação, comparado ao último passo aceito pela credencial.
 */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateSecret();
  }

  /** URI para aplicativos autenticadores; não contém dado clínico. */
  buildKeyUri(accountName: string, secret: string): string {
    return generateURI({
      issuer: 'Allervia',
      label: accountName,
      secret,
      period: PERIOD_SECONDS,
    });
  }

  verify(
    code: string,
    secret: string,
    lastUsedTimeStep: bigint | null,
  ): TotpVerification {
    const token = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return { valid: false, timeStep: null };

    let result: ReturnType<typeof verifySync>;
    try {
      result = verifySync({
        secret,
        token,
        period: PERIOD_SECONDS,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
        ...(lastUsedTimeStep === null
          ? {}
          : { afterTimeStep: Number(lastUsedTimeStep) }),
      });
    } catch {
      return { valid: false, timeStep: null };
    }

    if (!result.valid) return { valid: false, timeStep: null };

    // O wrapper funcional une os resultados de TOTP e HOTP, e só o primeiro
    // expõe `timeStep`. `delta` existe nos dois, então derivamos o passo aceito
    // a partir do passo atual — a rejeição de reuso já foi feita pela
    // biblioteca via `afterTimeStep`.
    const currentStep = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
    return { valid: true, timeStep: currentStep + result.delta };
  }
}
