import { Test, TestingModule } from '@nestjs/testing';
import { UpdateUserUseCase } from 'src/account/use-cases/update-user.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PrismaUserRepository } from 'src/account/prisma-user.repository';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { PrismaAuditLogService } from 'src/infra/audit/prisma-audit-log.service';
import { ulid } from 'ulid';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from 'src/security/bcrypt-password-hashing.service';
import { NotFoundException } from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { UpdateUserDto } from 'src/account/dtos/update-user.dto';

describe('UpdateUserPersonalUseCase - Integration', () => {
  let module: TestingModule;
  let updateUserPersonalUseCase: UpdateUserUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        UpdateUserUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: IUserRepository,
          useClass: PrismaUserRepository,
        },
        {
          provide: IPasswordHashingService,
          useClass: BcryptPasswordHashingService,
        },
        {
          provide: IAuditLogService,
          useClass: PrismaAuditLogService,
        },
      ],
    }).compile();

    updateUserPersonalUseCase = module.get(UpdateUserUseCase);
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

  it('persists professional profile fields and audits them', async () => {
    const user =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await updateUserPersonalUseCase.execute(
      user.id,
      {
        fullName: 'Updated professional',
        phoneNumber: '11999990000',
      },
      user,
    );
    const profile = await prisma.professional.findUniqueOrThrow({
      where: { userId: user.id },
    });
    expect(profile.fullName).toBe('Updated professional');
    expect(profile.phoneNumber).toBe('11999990000');
    expect(
      await prisma.auditLog.count({
        where: { entityId: profile.id, action: 'PROFESSIONAL_UPDATED' },
      }),
    ).toBe(1);
  });

  it('rejects unsupported fields without partially changing the account', async () => {
    const user =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await expect(
      updateUserPersonalUseCase.execute(
        user.id,
        {
          email: 'must-not-persist@example.com',
          specialty: 'Allergology',
        },
        user,
      ),
    ).rejects.toThrow('specialty');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email,
    ).toBe(user.email);
  });

  it('should persist updated email and audit the change', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdateUserDto = {
      email: 'updated@example.com',
    };

    const result = await updateUserPersonalUseCase.execute(
      authenticatedUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).toBeDefined();

    expect(result.email).toBe(dto.email);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: authenticatedUser.id },
        })
      ).email,
    ).toBe(dto.email);
    expect(
      await prisma.auditLog.count({
        where: { entityId: authenticatedUser.id },
      }),
    ).toBe(1);
  });

  it('should update password correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdateUserDto = {
      password: 'newpassword123',
    };

    const result = await updateUserPersonalUseCase.execute(
      authenticatedUser.id,
      dto,
      authenticatedUser,
    );

    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).toBeDefined();
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: authenticatedUser.id },
    });
    expect(stored.password).not.toBe(dto.password);
    expect(stored.tokenVersion).toBe(1);
    expect(
      await module
        .get<IPasswordHashingService>(IPasswordHashingService)
        .compare(dto.password!, stored.password),
    ).toBe(true);
  });

  it('should throw a not found exception when updating a non-existent user', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdateUserDto = {
      email: 'updated@example.com',
    };

    await expect(
      updateUserPersonalUseCase.execute(ulid(), dto, authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });
  it('should reject cross-organization updates without changing data or audit', async () => {
    const target =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const actor =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    await expect(
      updateUserPersonalUseCase.execute(
        target.id,
        { email: 'unauthorized@example.com' },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: target.id } }),
    ).toEqual(before);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
