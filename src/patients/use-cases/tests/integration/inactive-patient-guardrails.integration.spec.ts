import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { SessionService } from 'src/security/session/session.service';
import { IAuthSessionRepository } from 'src/security/session/auth-session.repository';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import { readBody, type ErrorBody } from 'test/support/http';

interface PatientListBody {
  items: Array<{ id: string; isActive: boolean }>;
  total: number;
}

describe('Paciente inativo - Integração HTTP', () => {
  let module: TestingModule;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let factories: TestFactories;
  let user: AuthenticatedUserPayload;

  beforeAll(async () => {
    process.env.AUTH_ALLOWED_ORIGINS = 'http://127.0.0.1';
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(buildValidationPipe());
    await app.init();
    prisma = module.get(PrismaService);
    catalog = module.get(ProtocolCatalogService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    user = await factories.users.createAuthenticatedPhysicianProfessional();
    const created = await catalog.create(
      {
        name: 'Synthetic test protocol',
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
  });

  async function token() {
    const context = await module
      .get(IAuthSessionRepository)
      .loadContextByUserId(user.id);
    if (!context) throw new Error('Missing test account');
    const issued = await module
      .get(SessionService)
      .issue(context, { userAgent: null, ipAddressHash: null }, null);
    return {
      Cookie: 'allervia_session_v2=' + issued.sessionSecret,
      Origin: 'http://127.0.0.1',
      'X-CSRF-Token': issued.csrfToken,
      'X-Session-Context': issued.session.id,
    };
  }

  async function inactivePatient() {
    return factories.patients.create({
      organizationId: user.organizationId,
      responsiblePhysicianId: user.professionalId!,
      createdById: user.id,
      updatedById: user.id,
      isActive: false,
    });
  }

  it('recusa nova imunoterapia para paciente inativo com PATIENT_INACTIVE', async () => {
    const patient = await inactivePatient();

    const response = await request(app.getHttpServer())
      .post('/immunotherapies/register')
      .set(await token())
      .send({
        idempotencyKey: 'inactive-patient-1',
        patientId: patient.id,
        immunoType: 'Synthetic',
        administrationRoute: 'SUBCUTANEOUS',
        extract: 'Synthetic extract',
        inductionStartDate: '2026-01-01T13:00:00Z',
        stepIds: ['low', 'middle', 'high'],
        startingStepId: 'low',
        targetStepId: 'high',
      })
      .expect(409);

    expect(readBody<ErrorBody>(response).code).toBe('PATIENT_INACTIVE');
    expect(
      await prisma.immunotherapy.count({ where: { patientId: patient.id } }),
    ).toBe(0);
  });

  it('mantém o paciente inativo visível na listagem', async () => {
    const patient = await inactivePatient();

    const response = await request(app.getHttpServer())
      .get('/patients')
      .set(await token())
      .expect(200);

    const page = readBody<PatientListBody>(response);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id: patient.id, isActive: false });
  });
});
