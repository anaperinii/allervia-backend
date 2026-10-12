import { Test, TestingModule } from '@nestjs/testing';
import { generateSync } from 'otplib';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { MfaService } from 'src/security/session/mfa.service';
import { IAuthSessionRepository } from 'src/security/session/auth-session.repository';
import {
  hashOpaqueSecret,
  normalizeRecoveryCode,
} from 'src/security/session/session.crypto';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';

const PERIOD_SECONDS = 30;

function totpCode(secret: string, stepsAhead = 0): string {
  return generateSync({
    secret,
    period: PERIOD_SECONDS,
    epoch: Math.floor(Date.now() / 1000) + stepsAhead * PERIOD_SECONDS,
  });
}

describe('Atomicidade do MFA sob concorrência (PostgreSQL real)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let mfa: MfaService;
  let repository: IAuthSessionRepository;
  let factories: TestFactories;
  let userId: string;

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    mfa = module.get(MfaService);
    repository = module.get(IAuthSessionRepository);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    const user =
      await factories.users.createAuthenticatedPhysicianProfessional();
    userId = user.id;
  });

  afterAll(async () => {
    if (module) await module.close();
    await TestDatabaseManager.disconnect();
  });

  async function confirmedFactor(): Promise<{
    credentialId: string;
    secret: string;
    recoveryCodes: string[];
  }> {
    const started = await mfa.startEnrollment(userId, 'ac@test', 'app');
    const confirmation = await mfa.confirmEnrollment(
      userId,
      started.credentialId,
      totpCode(started.secret),
    );
    return {
      credentialId: started.credentialId,
      secret: started.secret,
      recoveryCodes: confirmation.recoveryCodes,
    };
  }

  it('AC-09: duas verificações simultâneas do mesmo passo TOTP autenticam no máximo uma', async () => {
    const factor = await confirmedFactor();
    const code = totpCode(factor.secret, 1);

    const results = await Promise.all([
      mfa.verifyCode(userId, code),
      mfa.verifyCode(userId, code),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);

    const credential = await prisma.mfaCredential.findUniqueOrThrow({
      where: { id: factor.credentialId },
    });
    expect(credential.lastUsedCounter).not.toBeNull();
  });

  it('AC-10: contador é monotônico — replay sequencial do mesmo passo falha', async () => {
    const factor = await confirmedFactor();
    const code = totpCode(factor.secret, 1);

    await expect(mfa.verifyCode(userId, code)).resolves.toBe(true);
    await expect(mfa.verifyCode(userId, code)).resolves.toBe(false);

    const credential = await prisma.mfaCredential.findUniqueOrThrow({
      where: { id: factor.credentialId },
    });
    const counterAfter = credential.lastUsedCounter;

    await mfa.verifyCode(userId, code);
    const credentialAgain = await prisma.mfaCredential.findUniqueOrThrow({
      where: { id: factor.credentialId },
    });
    expect(credentialAgain.lastUsedCounter).toEqual(counterAfter);
  });

  it('AC-12: repetir a confirmação não regenera recovery codes nem devolve códigos antigos', async () => {
    const started = await mfa.startEnrollment(userId, 'ac@test', 'app');
    const first = await mfa.confirmEnrollment(
      userId,
      started.credentialId,
      totpCode(started.secret),
    );
    expect(first.recoveryCodes).toHaveLength(10);

    const hashesBefore = (
      await prisma.mfaRecoveryCode.findMany({
        where: { userId },
        orderBy: { codeHash: 'asc' },
      })
    ).map((row) => row.codeHash);

    await expect(
      mfa.confirmEnrollment(
        userId,
        started.credentialId,
        totpCode(started.secret, 1),
      ),
    ).rejects.toMatchObject({ code: 'MFA_ALREADY_CONFIRMED' });

    const hashesAfter = (
      await prisma.mfaRecoveryCode.findMany({
        where: { userId },
        orderBy: { codeHash: 'asc' },
      })
    ).map((row) => row.codeHash);
    expect(hashesAfter).toEqual(hashesBefore);
  });

  it('AC-12/13: confirmações concorrentes produzem exatamente um dono dos recovery codes', async () => {
    const started = await mfa.startEnrollment(userId, 'ac@test', 'app');
    const code = totpCode(started.secret);

    const results = await Promise.allSettled([
      mfa.confirmEnrollment(userId, started.credentialId, code),
      mfa.confirmEnrollment(userId, started.credentialId, code),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(CodedHttpException);

    expect(await prisma.mfaRecoveryCode.count({ where: { userId } })).toBe(10);
    const credential = await prisma.mfaCredential.findUniqueOrThrow({
      where: { id: started.credentialId },
    });
    expect(credential.confirmedAt).not.toBeNull();
  });

  it('AC-13: confirmação com código inválido não deixa estado parcial', async () => {
    const started = await mfa.startEnrollment(userId, 'ac@test', 'app');

    await expect(
      mfa.confirmEnrollment(userId, started.credentialId, '000000'),
    ).rejects.toMatchObject({ code: 'MFA_CODE_INVALID' });

    const credential = await prisma.mfaCredential.findUniqueOrThrow({
      where: { id: started.credentialId },
    });
    expect(credential.confirmedAt).toBeNull();
    expect(credential.lastUsedCounter).toBeNull();
    expect(await prisma.mfaRecoveryCode.count({ where: { userId } })).toBe(0);
  });

  it('AC-14: consumo concorrente do mesmo recovery code aceita exatamente um', async () => {
    const factor = await confirmedFactor();
    const recovery = factor.recoveryCodes[0];

    const results = await Promise.all([
      mfa.verifyCode(userId, recovery),
      mfa.verifyCode(userId, recovery),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const consumed = await prisma.mfaRecoveryCode.findFirstOrThrow({
      where: {
        userId,
        codeHash: hashOpaqueSecret(normalizeRecoveryCode(recovery)),
      },
    });
    expect(consumed.consumedAt).not.toBeNull();

    await expect(mfa.verifyCode(userId, recovery)).resolves.toBe(false);
  });

  it('CAS perdido no TOTP não cai no fallback de recovery code', async () => {
    const factor = await confirmedFactor();
    const code = totpCode(factor.secret, 1);
    await expect(mfa.verifyCode(userId, code)).resolves.toBe(true);

    const availableBefore = await prisma.mfaRecoveryCode.count({
      where: { userId, consumedAt: null },
    });
    await expect(mfa.verifyCode(userId, code)).resolves.toBe(false);
    const availableAfter = await prisma.mfaRecoveryCode.count({
      where: { userId, consumedAt: null },
    });
    expect(availableAfter).toBe(availableBefore);
  });

  it('fator revogado não autentica mesmo com código válido', async () => {
    const factor = await confirmedFactor();
    await mfa.revokeFactor(userId, factor.credentialId);
    await expect(
      mfa.verifyCode(userId, totpCode(factor.secret, 1)),
    ).resolves.toBe(false);
    const won = await repository.registerMfaCredentialUse(
      factor.credentialId,
      BigInt(Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + 5),
      new Date(),
    );
    expect(won).toBe(false);
  });
});
