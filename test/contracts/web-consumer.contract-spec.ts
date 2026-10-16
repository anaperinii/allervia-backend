import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SessionService } from 'src/security/session/session.service';
import { IAuthSessionRepository } from 'src/security/session/auth-session.repository';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.setup';
import { PrismaService } from 'src/infra/database/prisma.service';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';

describe('Web consumer against real Nest HTTP and PostgreSQL', () => {
  let app: NestExpressApplication;

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  it('validates the web contract using isolated synthetic records', async () => {
    const web = resolve(process.env.ALLERVIA_WEB_ROOT || '../allervia-web');
    const vitest = resolve(web, 'node_modules/vitest/vitest.mjs');
    if (!existsSync(vitest)) {
      throw new Error(
        'Install allervia-web dependencies and set ALLERVIA_WEB_ROOT if not a sibling checkout.',
      );
    }
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';

    await TestDatabaseManager.connect();
    await TestDatabaseManager.cleanAll();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const contractDirectory = resolve('docs/integration-baseline');
    mkdirSync(contractDirectory, { recursive: true });
    const openapi = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Allervia current HTTP baseline')
        .setVersion('i0-observed')
        .build(),
    );
    writeFileSync(
      resolve(contractDirectory, 'openapi-current.json'),
      JSON.stringify(openapi, null, 2) + '\n',
    );
    const prisma = module.get(PrismaService);
    const factories = new TestFactories(prisma);
    const user =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const catalog = module.get(ProtocolCatalogService);
    const created = await catalog.create(
      {
        name: 'Synthetic consumer contract',
        definition: syntheticProtocolDefinition(),
      },
      user,
    );
    await catalog.mutate(created.version.id, 0, user, 'publish');
    await catalog.mutate(created.version.id, 1, user, 'default');
    await catalog.settings(
      { enabled: true, timeZone: 'America/Sao_Paulo' },
      user,
    );
    const therapy = await module.get(CreateImmunotherapyUseCase).execute(
      {
        idempotencyKey: 'contract-fixture-1',
        patient: {
          fullName: 'Synthetic contract patient',
          birthDate: '1990-01-01',
          weightInKg: 70,
          phoneNumber: '11999999999',
          responsiblePhysicianId: user.professionalId!,
        },
        immunoType: 'Synthetic',
        extract: 'Synthetic',
        administrationRoute: 'SUBCUTANEOUS',
        inductionStartDate: '2026-01-01T13:00:00Z',
        protocolVersionId: created.version.id,
        stepIds: ['low', 'middle', 'high'],
        startingStepId: 'low',
        targetStepId: 'high',
      },
      user,
    );
    const context = await module
      .get(IAuthSessionRepository)
      .loadContextByUserId(user.id);
    if (!context) throw new Error('Missing synthetic account');
    const issued = await module
      .get(SessionService)
      .issue(
        context,
        { userAgent: 'contract-test', ipAddressHash: null },
        null,
      );
    const token = issued.sessionSecret;
    const childEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
      NODE_ENV: 'test',
      ALLERVIA_CONTRACT_URL: await app.getUrl(),
      ALLERVIA_CONTRACT_SESSION_ID: issued.session.id,
      ALLERVIA_CONTRACT_COOKIE: 'allervia_session_v2=' + issued.sessionSecret,
      ALLERVIA_CONTRACT_CSRF: issued.csrfToken,
      ALLERVIA_CONTRACT_DOSE_ID: therapy.firstDose.id,
      ALLERVIA_CONTRACT_PATIENT_ID: therapy.patient.id,
      ALLERVIA_CONTRACT_PHYSICIAN_ID: user.professionalId!,
    };
    const run = promisify(execFile);
    // Read structured counters so additional cases do not break the harness
    // and an empty consumer suite cannot pass.
    const reportPath = resolve(
      web,
      'artifacts',
      'contract',
      'web-consumer-results.json',
    );
    mkdirSync(resolve(web, 'artifacts', 'contract'), { recursive: true });
    try {
      await run(
        process.execPath,
        [
          vitest,
          'run',
          '--config',
          'vitest.contract.config.ts',
          '--reporter=json',
          `--outputFile=${reportPath}`,
        ],
        {
          cwd: web,
          env: childEnv,
          timeout: 90000,
          maxBuffer: 1024 * 1024,
        },
      );
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
        numTotalTests: number;
        numPassedTests: number;
        numFailedTests: number;
        numPendingTests?: number;
        numTodoTests?: number;
      };
      expect(report.numFailedTests).toBe(0);
      expect(report.numTotalTests).toBeGreaterThan(0);
      expect(report.numPassedTests).toBe(report.numTotalTests);
      expect((report.numPendingTests ?? 0) + (report.numTodoTests ?? 0)).toBe(0);
      expect(
        await prisma.dose.count({
          where: { immunotherapyId: therapy.immunotherapy.id },
        }),
      ).toBe(1);
    } catch (error) {
      const output = error as Error & { stdout?: string; stderr?: string };
      throw new Error(
        [output.message, output.stdout, output.stderr]
          .filter(Boolean)
          .join('\n')
          .replaceAll(token, '[REDACTED]')
          .replaceAll(issued.sessionSecret, '[REDACTED]'),
      );
    }
  });
});
