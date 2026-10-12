import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserStatusUseCase } from 'src/account/use-cases/update-user-status.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PrismaUserRepository } from 'src/account/prisma-user.repository';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { PrismaAuditLogService } from 'src/infra/audit/prisma-audit-log.service';
import { ulid } from 'ulid';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { UpdateUserStatusDto } from 'src/account/dtos/update-user-status.dto';
import { ConfigModule } from '@nestjs/config';
import { SessionConfig } from 'src/security/session/session.config';
import { SessionService } from 'src/security/session/session.service';
import { IAuthSessionRepository } from 'src/security/session/auth-session.repository';
import { PrismaAuthSessionRepository } from 'src/security/session/prisma-auth-session.repository';
import { UserAccessService } from 'src/account/user-access.service';

describe('UpdateUserStatusUseCase - Integration', () => {
  let module: TestingModule;
  let updateUserStatusUseCase: UpdateUserStatusUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        UpdateUserStatusUseCase,
        UserAccessService,
        SessionConfig,
        SessionService,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IUserRepository,
          useClass: PrismaUserRepository,
        },
        {
          provide: IAuditLogService,
          useClass: PrismaAuditLogService,
        },
        {
          provide: IAuthSessionRepository,
          useClass: PrismaAuthSessionRepository,
        },
      ],
    }).compile();

    updateUserStatusUseCase = module.get(UpdateUserStatusUseCase);
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    await TestDatabaseManager.disconnect();
  });

  it('NOV-04: bloqueia autodesativação também pela rota de conta', async () => {
    const admin = await factories.users.createAuthenticatedAdmin();
    await expect(
      updateUserStatusUseCase.execute(admin.id, { isActive: false }, admin),
    ).rejects.toThrow(ForbiddenException);
    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(persisted.isActive).toBe(true);
  });

  it('NOV-04: protege o último administrador também pela rota de conta', async () => {
    const admin = await factories.users.createAuthenticatedAdmin();
    const physician = await factories.users.createColleagueWithRoles(
      admin.organizationId,
      ['PHYSICIAN'],
    );

    await expect(
      updateUserStatusUseCase.execute(admin.id, { isActive: false }, physician),
    ).rejects.toMatchObject({ message: 'LAST_ADMINISTRATOR' });
    const persisted = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(persisted.isActive).toBe(true);
  });

  it('AC-19: desativações cruzadas simultâneas preservam ao menos um administrador', async () => {
    const adminA = await factories.users.createAuthenticatedAdmin();
    const adminB = await factories.users.createColleagueWithRoles(
      adminA.organizationId,
      ['ADMINISTRATOR'],
    );

    const results = await Promise.allSettled([
      updateUserStatusUseCase.execute(adminB.id, { isActive: false }, adminA),
      updateUserStatusUseCase.execute(adminA.id, { isActive: false }, adminB),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const activeAdministrators = await prisma.professional.count({
      where: {
        organizationId: adminA.organizationId,
        user: { isActive: true, isArchived: false },
        professionalRoles: { some: { role: 'ADMINISTRATOR', revokedAt: null } },
      },
    });
    expect(activeAdministrators).toBeGreaterThanOrEqual(1);
  });

  it('desativação grava pedido durável de teardown da conexão Google na mesma transação', async () => {
    const admin = await factories.users.createAuthenticatedAdmin();
    const target = await factories.users.createColleagueWithRoles(
      admin.organizationId,
      ['PHYSICIAN'],
    );
    await factories.googleCalendarConnections.create({
      professionalId: target.professionalId!,
      organizationId: admin.organizationId,
    });

    await updateUserStatusUseCase.execute(
      target.id,
      { isActive: false },
      admin,
    );

    const connection = await prisma.googleCalendarConnection.findFirstOrThrow();
    expect(connection.teardownRequestedAt).not.toBeNull();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(user.isActive).toBe(false);
  });

  it('should activate user correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {
        isActive: false,
      },
    );

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    const result = await updateUserStatusUseCase.execute(
      targetUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).toBeDefined();
    expect(result.isActive).toBe(true);
  });

  it('should deactivate user correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {
        isActive: true,
      },
    );

    const dto: UpdateUserStatusDto = {
      isActive: false,
    };

    const result = await updateUserStatusUseCase.execute(
      targetUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).toBeDefined();
    expect(result.isActive).toBe(false);
  });

  it('should throw a not found exception when updating a non-existent user', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    await expect(
      updateUserStatusUseCase.execute(ulid(), dto, authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw a not found exception when updating user from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const targetUser = await factories.users.createInOrganization(
      authenticatedUser.organizationId,
      {},
    );

    const dto: UpdateUserStatusDto = {
      isActive: true,
    };

    await expect(
      updateUserStatusUseCase.execute(
        targetUser.id,
        dto,
        authenticatedUserAnotherOrg,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
