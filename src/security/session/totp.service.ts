import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';

const PERIOD_SECONDS = 30;
const EPOCH_TOLERANCE_SECONDS = PERIOD_SECONDS;

export interface TotpVerification {
  valid: boolean;
  timeStep: number | null;
}

@Injectable()
export class TotpService {
  generateSecret(): string {
    return generateSecret();
  }

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

    const currentStep = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
    return { valid: true, timeStep: currentStep + result.delta };
  }
}
