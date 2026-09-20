import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { DomainExceptionFilter } from 'src/infra/filters/domain-exception.filter';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';

describe('Web consumer against real Nest HTTP and PostgreSQL', () => {
  let app: INestApplication;

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
    // Sem HTTPS no servidor efêmero, os atributos do cookie são exercitados em
    // modo de desenvolvimento explícito.
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_LEGACY_BEARER = 'enabled';

    await TestDatabaseManager.connect();
    await TestDatabaseManager.cleanAll();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    app = module.createNestApplication();
    // O consumidor real roda atrás do mesmo transporte da aplicação: cookies
    // analisados, validação com erros por campo e envelope único de erro.
    app.use(cookieParser());
    app.useGlobalPipes(buildValidationPipe());
    app.useGlobalFilters(new DomainExceptionFilter());
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
          birthDate: new Date('1990-01-01'),
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
    const token = module.get(JwtService).sign({
      sub: user.id,
      email: user.email,
      type: user.type,
      organizationId: user.organizationId,
      professionalId: user.professionalId,
      roles: user.roles,
      tokenVersion: 0,
    });
    // Do not pass credentials on argv or serialize the parent environment into reports.
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
      ALLERVIA_CONTRACT_TOKEN: token,
      ALLERVIA_CONTRACT_DOSE_ID: therapy.firstDose.id,
    };
    const run = promisify(execFile);
    try {
      const result = await run(
        process.execPath,
        [vitest, 'run', '--config', 'vitest.contract.config.ts'],
        {
          cwd: web,
          env: childEnv,
          timeout: 90000,
          maxBuffer: 1024 * 1024,
        },
      );
      expect(result.stdout).toContain('9 passed');
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
          .replaceAll(token, '[REDACTED]'),
      );
    }
  });
});
