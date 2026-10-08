import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import {
  StartSessionUseCase,
  StartSessionInput,
} from 'src/security/session/use-cases/start-session.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import * as bcrypt from 'bcrypt';

describe('Unified login - Integration', () => {
  let module: TestingModule;
  let loginUseCase: StartSessionUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;
  beforeAll(async () => {
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    loginUseCase = module.get(StartSessionUseCase);
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

  it('should login user correctly with valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await factories.users.createAuthenticatedPhysicianProfessional(
      {
        email: 'test@example.com',
        password: hashedPassword,
      },
    );

    const dto: Pick<StartSessionInput, 'email' | 'password'> = {
      email: user.email,
      password: 'password123',
    };

    const result = await loginUseCase.execute({
      ...dto,
      device: { userAgent: null, ipAddressHash: null },
      clientIp: null,
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('AUTHENTICATED');
    if (result.status !== 'AUTHENTICATED')
      throw new Error('Unexpected MFA challenge');
    expect(result.issued.sessionSecret).toBeDefined();
  });

  it('rejects a professional without an organization', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const user = await factories.users.create({
      email: 'test@example.com',
      password: hashedPassword,
    });

    const dto: Pick<StartSessionInput, 'email' | 'password'> = {
      email: user.email,
      password: 'password123',
    };

    await expect(
      loginUseCase.execute({
        ...dto,
        device: { userAgent: null, ipAddressHash: null },
        clientIp: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw unauthorized exception when email does not exist', async () => {
    const dto: Pick<StartSessionInput, 'email' | 'password'> = {
      email: 'nonexistent@example.com',
      password: 'password123',
    };

    await expect(
      loginUseCase.execute({
        ...dto,
        device: { userAgent: null, ipAddressHash: null },
        clientIp: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw unauthorized exception when password is incorrect', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await factories.users.create({
      email: 'test@example.com',
      password: hashedPassword,
    });

    const dto: Pick<StartSessionInput, 'email' | 'password'> = {
      email: user.email,
      password: 'wrongpassword',
    };

    await expect(
      loginUseCase.execute({
        ...dto,
        device: { userAgent: null, ipAddressHash: null },
        clientIp: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
