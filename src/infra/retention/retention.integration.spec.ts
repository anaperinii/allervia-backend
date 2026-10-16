import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { RetentionService } from 'src/infra/retention/retention.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';

const DAY_MS = 24 * 3600_000;

describe('RetentionService (AC-69/70/71)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let retention: RetentionService;
  let factories: TestFactories;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    retention = module.get(RetentionService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    delete process.env.ALLERVIA_RETENTION_ENABLED;
    await TestDatabaseManager.cleanAll();
    const user =
      await factories.users.createAuthenticatedPhysicianProfessional();
    userId = user.id;
    organizationId = user.organizationId;
  });

  afterAll(async () => {
    if (module) await module.close();
    await TestDatabaseManager.disconnect();
  });

  async function seedAuthAttempts() {
    await prisma.authAttempt.createMany({
      data: [
        {
          identifierHash: 'old',
          scope: 'account',
          operation: 'login',
          succeeded: false,
          occurredAt: new Date(Date.now() - 2 * DAY_MS),
        },
        {
          identifierHash: 'fresh',
          scope: 'account',
          operation: 'login',
          succeeded: false,
          occurredAt: new Date(),
        },
      ],
    });
  }

  it('AC-69: dry-run conta elegíveis e não remove nada (default sem DEC-03)', async () => {
    await seedAuthAttempts();

    const result = await retention.runOnce();

    expect(result.dryRun).toBe(true);
    const attempts = result.classes.find((c) => c.model === 'authAttempt')!;
    expect(attempts.eligible).toBe(1);
    expect(attempts.deleted).toBe(0);
    expect(await prisma.authAttempt.count()).toBe(2);
  });

  it('AC-69: habilitado remove só o elegível, preservando janela/estado ativo', async () => {
    process.env.ALLERVIA_RETENTION_ENABLED = 'true';
    await seedAuthAttempts();

    await prisma.mfaCredential.create({
      data: {
        userId,
        label: 'pendente-velho',
        secretCiphertext: 'c',
        secretIv: 'i',
        secretAuthTag: 't',
        createdAt: new Date(Date.now() - 2 * DAY_MS),
      },
    });
    await prisma.mfaCredential.create({
      data: {
        userId,
        label: 'confirmado-velho',
        secretCiphertext: 'c',
        secretIv: 'i',
        secretAuthTag: 't',
        createdAt: new Date(Date.now() - 30 * DAY_MS),
        confirmedAt: new Date(Date.now() - 30 * DAY_MS),
      },
    });

    await prisma.authSession.create({
      data: {
        userId,
        organizationId,
        secretHash: 'h1'.padEnd(64, 'a'),
        authVersion: 1,
        expiresAt: new Date(Date.now() + DAY_MS),
        lastInteractiveAt: new Date(),
      },
    });
    await prisma.authSession.create({
      data: {
        userId,
        organizationId,
        secretHash: 'h2'.padEnd(64, 'b'),
        authVersion: 1,
        expiresAt: new Date(Date.now() - 61 * DAY_MS),
        lastInteractiveAt: new Date(Date.now() - 61 * DAY_MS),
        revokedAt: new Date(Date.now() - 60 * DAY_MS),
      },
    });

    const result = await retention.runOnce();

    expect(result.dryRun).toBe(false);
    expect(await prisma.authAttempt.count()).toBe(1);
    const factors = await prisma.mfaCredential.findMany();
    expect(factors).toHaveLength(1);
    expect(factors[0].label).toBe('confirmado-velho');
    const sessions = await prisma.authSession.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].revokedAt).toBeNull();
  });

  it('AC-70: execuções concorrentes não removem além do elegível nem falham', async () => {
    process.env.ALLERVIA_RETENTION_ENABLED = 'true';
    await prisma.authAttempt.createMany({
      data: Array.from({ length: 40 }, (_, index) => ({
        identifierHash: `old-${index}`,
        scope: 'account',
        operation: 'login',
        succeeded: false,
        occurredAt: new Date(Date.now() - 2 * DAY_MS),
      })),
    });

    const [first, second] = await Promise.all([
      retention.runOnce(),
      retention.runOnce(),
    ]);

    const removedTotal =
      first.classes.find((c) => c.model === 'authAttempt')!.deleted +
      second.classes.find((c) => c.model === 'authAttempt')!.deleted;
    expect(removedTotal).toBe(40);
    expect(await prisma.authAttempt.count()).toBe(0);
  });

  it('AC-71: comandos clínicos idempotentes e audit log ficam fora do expurgo', async () => {
    process.env.ALLERVIA_RETENTION_ENABLED = 'true';
    const result = await retention.runOnce();
    const models = result.classes.map((c) => c.model);
    expect(models).not.toContain('clinicalCommand');
    expect(models).not.toContain('registrationCommand');
    expect(models).not.toContain('auditLog');
  });
});
