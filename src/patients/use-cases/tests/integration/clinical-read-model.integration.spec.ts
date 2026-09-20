import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { hash } from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  findCookie,
  joinCookies,
  readBody,
  type CsrfBody,
  type SessionBody,
} from 'test/support/http';

const PASSWORD = 'Senha!Forte#2026';
const ORIGIN = 'http://127.0.0.1';
const SESSION_COOKIE = 'allervia_session';

interface PatientPage {
  items: Array<{
    id: string;
    fullName: string;
    cpfMasked: string | null;
    therapyCount: number;
    responsiblePhysician: { id: string };
  }>;
  total: number;
  page: number;
}

interface PatientDetail {
  id: string;
  cpf?: string | null;
  cpfMasked: string | null;
  therapies: Array<{
    id: string;
    status: string;
    prescription: { versionId: string; revision: number } | null;
    nextDose: { id: string; scheduledAt: string } | null;
  }>;
}

interface TherapyDetail {
  id: string;
  patient: { id: string };
  prescription: { versionId: string; resolved?: unknown } | null;
  nextDose: { id: string } | null;
  doseCount: number;
}

/**
 * Prontuário de leitura sobre HTTP real: paginação escopada, CPF protegido,
 * dois tratamentos do mesmo paciente sem mistura de doses e histórico lido do
 * snapshot da prescrição.
 */
describe('Prontuário de leitura - Integração HTTP', () => {
  let app: INestApplication<App>;
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;
  let versionId: string;

  beforeAll(async () => {
    process.env.AUTH_INSECURE_COOKIES = 'true';
    process.env.AUTH_MFA_ENFORCEMENT = 'optional';
    process.env.AUTH_ALLOWED_ORIGINS = ORIGIN;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

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
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();

    physician = await factories.users.createAuthenticatedPhysicianProfessional({
      password: await hash(PASSWORD, 10),
    });

    const catalog = module.get(ProtocolCatalogService);
    const created = await catalog.create(
      {
        name: 'Protocolo sintético',
        definition: syntheticProtocolDefinition(),
      },
      physician,
    );
    versionId = created.version.id;
    await catalog.mutate(versionId, 0, physician, 'publish');
    await catalog.mutate(versionId, 1, physician, 'default');
    await catalog.settings(
      { enabled: true, timeZone: 'America/Sao_Paulo' },
      physician,
    );
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  const server = () => request(app.getHttpServer());

  async function login(email: string) {
    const challenge = await server().get('/auth/csrf').expect(200);
    const response = await server()
      .post('/auth/sessions')
      .set('Origin', ORIGIN)
      .set('Cookie', joinCookies(challenge))
      .set('X-CSRF-Token', readBody<CsrfBody>(challenge).csrfToken)
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      cookie: findCookie(response, SESSION_COOKIE),
      csrfToken: readBody<SessionBody>(response).csrfToken,
    };
  }

  function createTherapy(fullName: string, extract: string) {
    return module.get(CreateImmunotherapyUseCase).execute(
      {
        patient: {
          fullName,
          birthDate: new Date('1990-01-01'),
          weightInKg: 70,
          phoneNumber: '11999999999',
          responsiblePhysicianId: physician.professionalId!,
        },
        immunoType: 'SCIT',
        extract,
        administrationRoute: 'SUBCUTANEOUS',
        inductionStartDate: '2026-01-01T13:00:00Z',
        protocolVersionId: versionId,
        stepIds: ['low', 'middle', 'high'],
        startingStepId: 'low',
        targetStepId: 'high',
      },
      physician,
    );
  }

  it('pagina pacientes com busca e total no escopo', async () => {
    await createTherapy('Ana Souza', 'Der p 100%');
    await createTherapy('Bruno Lima', 'Der f 100%');

    const session = await login(physician.email);

    const firstPage = await server()
      .get('/patients?pageSize=1&page=1')
      .set('Cookie', session.cookie)
      .expect(200);

    const page = readBody<PatientPage>(firstPage);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);

    const searched = await server()
      .get('/patients?search=ana')
      .set('Cookie', session.cookie)
      .expect(200);

    const found = readBody<PatientPage>(searched);
    expect(found.total).toBe(1);
    expect(found.items[0].fullName).toBe('Ana Souza');
    expect(found.items[0].therapyCount).toBe(1);
  });

  it('médico não enxerga pacientes de outro responsável, nem no total', async () => {
    await createTherapy('Paciente do Titular', 'Der p 100%');

    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
      { password: await hash(PASSWORD, 10) },
    );

    const session = await login(colleague.email);
    const listed = await server()
      .get('/patients')
      .set('Cookie', session.cookie)
      .expect(200);

    expect(readBody<PatientPage>(listed).total).toBe(0);
  });

  it('dois tratamentos do mesmo paciente não misturam doses', async () => {
    const first = await createTherapy('Carla Mendes', 'Der p 100%');
    const patientId = first.immunotherapy.patientId;

    // Segundo tratamento para o MESMO paciente, direto no banco: o comando de
    // prescrição para paciente existente chega na I5.
    const secondTherapy = await factories.immunotherapies.create({
      patientId,
      targetConcentration: 1000,
      targetVolume: 0.4,
      inductionStartDate: new Date('2026-02-01T13:00:00Z'),
      createdById: physician.id,
      updatedById: physician.id,
    });
    const secondDose = await factories.doses.create({
      immunotherapyId: secondTherapy.id,
      concentration: 1000,
      volume: 0.2,
      nextIntervalInDays: 7,
      scheduledAt: new Date('2026-02-08T13:00:00Z'),
      createdById: physician.id,
      updatedById: physician.id,
    });

    const session = await login(physician.email);

    const detail = await server()
      .get(`/patients/${patientId}`)
      .set('Cookie', session.cookie)
      .expect(200);

    const patient = readBody<PatientDetail>(detail);
    expect(patient.therapies).toHaveLength(2);

    const firstSummary = patient.therapies.find(
      (therapy) => therapy.id === first.immunotherapy.id,
    );
    const secondSummary = patient.therapies.find(
      (therapy) => therapy.id === secondTherapy.id,
    );

    expect(firstSummary?.nextDose?.id).toBe(first.firstDose.id);
    expect(secondSummary?.nextDose?.id).toBe(secondDose.id);
    expect(firstSummary?.nextDose?.id).not.toBe(secondSummary?.nextDose?.id);

    const therapyDetail = await server()
      .get(`/immunotherapies/${first.immunotherapy.id}`)
      .set('Cookie', session.cookie)
      .expect(200);

    const therapy = readBody<TherapyDetail>(therapyDetail);
    expect(therapy.patient.id).toBe(patientId);
    expect(therapy.doseCount).toBe(1);
    expect(therapy.nextDose?.id).toBe(first.firstDose.id);
  });

  it('mantém o snapshot da prescrição na leitura do tratamento', async () => {
    const created = await createTherapy('Diego Alves', 'Der p 100%');

    const session = await login(physician.email);
    const detail = await server()
      .get(`/immunotherapies/${created.immunotherapy.id}`)
      .set('Cookie', session.cookie)
      .expect(200);

    const therapy = readBody<TherapyDetail>(detail);
    expect(therapy.prescription?.versionId).toBe(versionId);
    // O snapshot resolvido acompanha o detalhe: histórico é lido daqui, não da
    // versão padrão vigente.
    expect(therapy.prescription?.resolved).toBeDefined();
  });

  it('protege o CPF: completo para quem edita, mascarado para quem lê', async () => {
    const created = await createTherapy('Elisa Prado', 'Der p 100%');
    const patientId = created.immunotherapy.patientId;

    const session = await login(physician.email);

    await server()
      .patch(`/patients/update/${patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ cpf: '529.982.247-25' })
      .expect(200);

    const asPhysician = await server()
      .get(`/patients/${patientId}`)
      .set('Cookie', session.cookie)
      .expect(200);

    const full = readBody<PatientDetail>(asPhysician);
    expect(full.cpf).toBe('52998224725');
    expect(full.cpfMasked).toBe('***.***.*47-25');

    // Enfermagem lê o prontuário, mas não edita o cadastro: recebe a máscara.
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
      { password: await hash(PASSWORD, 10) },
    );
    const nurseSession = await login(nurse.email);

    const asNurse = await server()
      .get(`/patients/${patientId}`)
      .set('Cookie', nurseSession.cookie)
      .expect(200);

    const masked = readBody<PatientDetail>(asNurse);
    expect(masked.cpf).toBeUndefined();
    expect(masked.cpfMasked).toBe('***.***.*47-25');
    expect(JSON.stringify(masked)).not.toContain('52998224725');
  });

  it('recusa CPF inválido e CPF duplicado na organização', async () => {
    const first = await createTherapy('Fabio Reis', 'Der p 100%');
    const second = await createTherapy('Gina Motta', 'Der f 100%');
    const session = await login(physician.email);

    const invalid = await server()
      .patch(`/patients/update/${first.immunotherapy.patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ cpf: '111.111.111-11' })
      .expect(400);
    expect(readBody<{ code: string }>(invalid).code).toBe('VALIDATION_ERROR');

    await server()
      .patch(`/patients/update/${first.immunotherapy.patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ cpf: '529.982.247-25' })
      .expect(200);

    const duplicate = await server()
      .patch(`/patients/update/${second.immunotherapy.patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ cpf: '52998224725' })
      .expect(409);
    expect(readBody<{ code: string }>(duplicate).code).toBe('CONFLICT');
  });

  it('valida o vínculo do novo médico responsável na edição', async () => {
    const created = await createTherapy('Hugo Braga', 'Der p 100%');
    const session = await login(physician.email);

    const stranger =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await server()
      .patch(`/patients/update/${created.immunotherapy.patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ responsiblePhysicianId: stranger.professionalId })
      .expect(404);

    const nurseColleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );

    // Enfermeiro da mesma organização não é médico: também não pode assumir.
    await server()
      .patch(`/patients/update/${created.immunotherapy.patientId}`)
      .set('Origin', ORIGIN)
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ responsiblePhysicianId: nurseColleague.professionalId })
      .expect(404);
  });
});
