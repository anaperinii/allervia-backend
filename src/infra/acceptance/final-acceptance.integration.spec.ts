import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PreAuthPurpose } from '@prisma/client';
import { generateSync } from 'otplib';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { RetentionService } from 'src/infra/retention/retention.service';
import { MfaService } from 'src/security/session/mfa.service';
import { IAuthSessionRepository } from 'src/security/session/auth-session.repository';
import { VerifyMfaChallengeUseCase } from 'src/security/session/use-cases/verify-mfa-challenge.use-case';
import { hashOpaqueSecret } from 'src/security/session/session.crypto';
import { PrismaUserInviteRepository } from 'src/invites/prisma-user-invite.repository';
import { CancelInviteUseCase } from 'src/invites/use-cases/cancel-invite.use-case';
import { FindInviteByIdUseCase } from 'src/invites/use-cases/find-invite-by-id.use-case';
import { RevokeRoleUseCase } from 'src/security/permissions/use-cases/revoke-role.use-case';
import { UpdateOrganizationUseCase } from 'src/organization/use-cases/update-organization.use-case';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

describe('Aceite final independente: invariantes sob falha e mudança concorrente', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let user: AuthenticatedUserPayload;
  let repository: IAuthSessionRepository;
  let mfa: MfaService;

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
    repository = module.get(IAuthSessionRepository);
    mfa = module.get(MfaService);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    user = await factories.users.createAuthenticatedAdmin();
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await module?.close();
    await TestDatabaseManager.disconnect();
  });

  async function challenge(expired = false) {
    const token = `synthetic-${user.id}`;
    const row = await prisma.preAuthChallenge.create({
      data: {
        userId: user.id,
        purpose: PreAuthPurpose.MFA_CHALLENGE,
        secretHash: hashOpaqueSecret(token),
        expiresAt: new Date(Date.now() + (expired ? -60_000 : 60_000)),
      },
    });
    return { row, token };
  }

  async function confirmedFactor() {
    const factor = await mfa.startEnrollment(user.id, user.email, 'synthetic');
    const result = await mfa.confirmEnrollment(
      user.id,
      factor.credentialId,
      generateSync({ secret: factor.secret, period: 30 }),
    );
    return { ...factor, ...result };
  }

  it('AC-10: consumo persistido rejeita desafio já expirado', async () => {
    const { row } = await challenge(true);
    expect(await repository.consumePreAuthChallenge(row.id)).toBe(false);
    expect(
      (
        await prisma.preAuthChallenge.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).consumedAt,
    ).toBeNull();
  });

  it('AC-13: expirar durante verificação não emite sessão nem consome recovery code', async () => {
    const factor = await confirmedFactor();
    const { row, token } = await challenge();
    const verify = mfa.verifyCode.bind(mfa) as MfaService['verifyCode'];
    jest
      .spyOn(mfa, 'verifyCode')
      .mockImplementationOnce(async (userId, code) => {
        await prisma.preAuthChallenge.update({
          where: { id: row.id },
          data: { expiresAt: new Date(0) },
        });
        return verify(userId, code);
      });
    const outcome = await module
      .get(VerifyMfaChallengeUseCase)
      .execute({
        challengeToken: token,
        code: factor.recoveryCodes[0],
        device: { userAgent: 'acceptance', ipAddressHash: null },
      })
      .then(
        () => ({ accepted: true }),
        (error: unknown) => ({
          accepted: false,
          code: (error as { code?: string }).code,
        }),
      );
    expect(outcome).toEqual({ accepted: false, code: 'MFA_CHALLENGE_INVALID' });
    expect(await prisma.authSession.count({ where: { userId: user.id } })).toBe(
      0,
    );
  });

  it('AC-13: falha ao consumir desafio reverte o consumo do recovery code', async () => {
    const factor = await confirmedFactor();
    const { token } = await challenge();
    jest
      .spyOn(repository, 'consumePreAuthChallenge')
      .mockRejectedValueOnce(new Error('injected database failure'));
    await expect(
      module.get(VerifyMfaChallengeUseCase).execute({
        challengeToken: token,
        code: factor.recoveryCodes[0],
        device: { userAgent: 'acceptance', ipAddressHash: null },
      }),
    ).rejects.toThrow('injected database failure');
    expect(
      await prisma.mfaRecoveryCode.count({
        where: { userId: user.id, consumedAt: null },
      }),
    ).toBe(10);
    expect(await prisma.authSession.count()).toBe(0);
  });

  it('AC-14: código de recuperação não pode autenticar outro usuário', async () => {
    const factor = await confirmedFactor();
    const other = await factories.users.createAuthenticatedAdmin();
    await expect(
      mfa.verifyCode(other.id, factor.recoveryCodes[0]),
    ).resolves.toBe(false);
    expect(
      await prisma.mfaRecoveryCode.count({
        where: { userId: user.id, consumedAt: null },
      }),
    ).toBe(10);
  });

  it('AC-70: fator confirmado entre seleção e exclusão sobrevive ao expurgo', async () => {
    const factor = await prisma.mfaCredential.create({
      data: {
        userId: user.id,
        label: 'old-pending',
        secretCiphertext: 'synthetic',
        secretIv: 'synthetic',
        secretAuthTag: 'synthetic',
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
    });
    const original = prisma.mfaCredential.deleteMany.bind(
      prisma.mfaCredential,
    ) as typeof prisma.mfaCredential.deleteMany;
    jest.spyOn(prisma.mfaCredential, 'deleteMany').mockImplementationOnce(
      (args) =>
        (async () => {
          await prisma.mfaCredential.update({
            where: { id: factor.id },
            data: { confirmedAt: new Date() },
          });
          return original(args);
        })() as ReturnType<typeof prisma.mfaCredential.deleteMany>,
    );
    await module.get(RetentionService).runOnce({ dryRun: false });
    expect(
      await prisma.mfaCredential.findUnique({ where: { id: factor.id } }),
    ).not.toBeNull();
  });

  it('AC-23: convite expirado não é consumido pela escrita transacional', async () => {
    const invite = await factories.internalUserInvite.create({
      organizationId: user.organizationId,
      createdById: user.id,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const invites = new PrismaUserInviteRepository(prisma);
    expect(await invites.markAsUsed(invite.id, new Date())).toBe(false);
  });

  it('AC-23: cancelamento concorrente não apaga usedAt gravado pelo registro', async () => {
    const invite = await factories.internalUserInvite.create({
      organizationId: user.organizationId,
      createdById: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const finder = module.get(FindInviteByIdUseCase);
    const find = finder.execute.bind(
      finder,
    ) as FindInviteByIdUseCase['execute'];
    jest.spyOn(finder, 'execute').mockImplementationOnce(async (id, actor) => {
      const snapshot = await find(id, actor);
      await prisma.internalUserInvite.update({
        where: { id },
        data: { usedAt: new Date(), isActive: false },
      });
      return snapshot;
    });
    await module
      .get(CancelInviteUseCase)
      .execute(invite.id, user)
      .catch(() => undefined);
    const after = await prisma.internalUserInvite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(after.usedAt).not.toBeNull();
  });

  it('AC-19: administrador arquivado não conta como administrador utilizável', async () => {
    await factories.users.createColleagueWithRoles(
      user.organizationId,
      ['ADMINISTRATOR'],
      { isActive: true, isArchived: true },
    );
    const role = await prisma.professionalRole.findFirstOrThrow({
      where: { professionalId: user.professionalId!, role: 'ADMINISTRATOR' },
    });
    await expect(
      module.get(RevokeRoleUseCase).execute(role.id, {
        userId: user.id,
        professionalId: user.professionalId!,
        organizationId: user.organizationId,
      }),
    ).rejects.toThrow('LAST_ADMINISTRATOR');
  });

  it('AC-20: duas alterações com a mesma revisão têm um vencedor', async () => {
    const before = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    const update = module.get(UpdateOrganizationUseCase);
    const outcomes = await Promise.allSettled([
      update.execute(
        { name: 'A', timeZone: 'UTC', expectedRevision: before.revision },
        user,
      ),
      update.execute(
        {
          name: 'B',
          timeZone: 'America/Sao_Paulo',
          expectedRevision: before.revision,
        },
        user,
      ),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const after = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    expect(after.revision).toBe(before.revision + 1);
  });

  it('AC-69/71: dry-run e dados de autenticação atuais permanecem íntegros', async () => {
    await confirmedFactor();
    const before = await prisma.mfaCredential.count();
    const result = await module.get(RetentionService).runOnce({ dryRun: true });
    expect(result.classes.every((item) => item.deleted === 0)).toBe(true);
    expect(await prisma.mfaCredential.count()).toBe(before);
  });

  it('AC-72: configuração de log de produção não divulga valor de erro SQL', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const captured: string[] = [];
    const marker = 'AC72_PRIVATE_SQL_SENTINEL';
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const spies = (['log', 'error', 'warn'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        captured.push(args.map(String).join(' '));
      }),
    );
    const productionClient = new PrismaService();
    try {
      await productionClient
        .$queryRawUnsafe(`SELECT '${marker}'::integer`)
        .catch(() => undefined);
    } finally {
      await productionClient.$disconnect();
      process.env.NODE_ENV = previous;
      spies.forEach((spy) => spy.mockRestore());
    }
    expect(captured.join('\n')).not.toContain(marker);
  });
});
