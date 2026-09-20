import { Injectable, NotFoundException } from '@nestjs/common';
import { CodedUnauthorizedException } from 'src/infra/exceptions/coded.exception';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from '../auth.messages';
import { IAuthSessionRepository } from './auth-session.repository';
import { SecretBoxService } from './secret-box.service';
import {
  generateRecoveryCode,
  hashOpaqueSecret,
  normalizeRecoveryCode,
} from './session.crypto';
import { TotpService } from './totp.service';

const RECOVERY_CODE_COUNT = 10;

export interface EnrollmentStart {
  credentialId: string;
  /** Segredo exibido uma vez para o aplicativo autenticador. */
  secret: string;
  keyUri: string;
}

export interface EnrollmentConfirmation {
  /** Códigos exibidos uma única vez; o banco guarda apenas o hash. */
  recoveryCodes: string[];
}

@Injectable()
export class MfaService {
  constructor(
    private readonly repository: IAuthSessionRepository,
    private readonly secretBox: SecretBoxService,
    private readonly totp: TotpService,
  ) {}

  get available(): boolean {
    return this.secretBox.available;
  }

  async startEnrollment(
    userId: string,
    accountName: string,
    label: string,
  ): Promise<EnrollmentStart> {
    const secret = this.totp.generateSecret();
    const sealed = this.secretBox.seal(secret);

    const credential = await this.repository.createMfaCredential({
      userId,
      label,
      secretCiphertext: sealed.ciphertext,
      secretIv: sealed.iv,
      secretAuthTag: sealed.authTag,
      keyVersion: sealed.keyVersion,
    });

    return {
      credentialId: credential.id,
      secret,
      keyUri: this.totp.buildKeyUri(accountName, secret),
    };
  }

  /**
   * Confirma a credencial com um código válido e emite novos códigos de
   * recuperação, invalidando os anteriores.
   */
  async confirmEnrollment(
    userId: string,
    credentialId: string,
    code: string,
  ): Promise<EnrollmentConfirmation> {
    const credential = await this.repository.findMfaCredential(
      credentialId,
      userId,
    );

    if (!credential) {
      throw new NotFoundException(AUTH_MESSAGES.mfaCredentialNotFound);
    }

    const secret = this.secretBox.open({
      ciphertext: credential.secretCiphertext,
      iv: credential.secretIv,
      authTag: credential.secretAuthTag,
      keyVersion: credential.keyVersion,
    });

    const verification = this.totp.verify(
      code,
      secret,
      credential.lastUsedCounter,
    );

    if (!verification.valid || verification.timeStep === null) {
      throw new CodedUnauthorizedException(
        AUTH_ERROR_CODES.mfaCodeInvalid,
        AUTH_MESSAGES.mfaCodeInvalid,
      );
    }

    const now = new Date();
    if (!credential.confirmedAt) {
      await this.repository.confirmMfaCredential(credential.id, now);
    }
    await this.repository.registerMfaCredentialUse(
      credential.id,
      BigInt(verification.timeStep),
      now,
    );

    return { recoveryCodes: await this.regenerateRecoveryCodes(userId) };
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateRecoveryCode(),
    );

    await this.repository.replaceRecoveryCodes(
      userId,
      codes.map((code) => hashOpaqueSecret(normalizeRecoveryCode(code))),
    );

    return codes;
  }

  /**
   * Verifica um código de qualquer credencial confirmada; se nenhuma aceitar,
   * tenta consumir um código de recuperação. O consumo é atômico.
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const credentials = await this.repository.listMfaCredentials(userId);
    const confirmed = credentials.filter((item) => item.confirmedAt !== null);

    for (const credential of confirmed) {
      const secret = this.secretBox.open({
        ciphertext: credential.secretCiphertext,
        iv: credential.secretIv,
        authTag: credential.secretAuthTag,
        keyVersion: credential.keyVersion,
      });

      const verification = this.totp.verify(
        code,
        secret,
        credential.lastUsedCounter,
      );

      if (verification.valid && verification.timeStep !== null) {
        await this.repository.registerMfaCredentialUse(
          credential.id,
          BigInt(verification.timeStep),
          new Date(),
        );
        return true;
      }
    }

    return this.repository.consumeRecoveryCode(
      userId,
      hashOpaqueSecret(normalizeRecoveryCode(code)),
    );
  }

  async listFactors(userId: string): Promise<
    Array<{
      id: string;
      label: string;
      confirmed: boolean;
    }>
  > {
    const credentials = await this.repository.listMfaCredentials(userId);
    return credentials.map((credential) => ({
      id: credential.id,
      label: credential.label,
      confirmed: credential.confirmedAt !== null,
    }));
  }

  async revokeFactor(userId: string, credentialId: string): Promise<void> {
    const credential = await this.repository.findMfaCredential(
      credentialId,
      userId,
    );
    if (!credential) {
      throw new NotFoundException(AUTH_MESSAGES.mfaCredentialNotFound);
    }
    await this.repository.revokeMfaCredential(credential.id, new Date());
  }

  async countRemainingRecoveryCodes(userId: string): Promise<number> {
    return this.repository.countAvailableRecoveryCodes(userId);
  }
}
