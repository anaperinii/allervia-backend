import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from 'src/app.setup';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from './database/test-database.manager';
import { PROVISIONING_HEADER } from 'src/organization/provisioning/provisioning.guard';
import { expectErrorEnvelope } from './support/envelope';

const PROVISIONING_KEY = 'e2e-test-provisioning-key-0001';
const SYSTEM_ACTOR_ID = 'E2E0SYSTEM0ACTOR0000000000';

describe('Application HTTP contracts (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.SUPER_ADMIN_REGISTRATION_KEY = PROVISIONING_KEY;
    process.env.SYSTEM_USER_ID = SYSTEM_ACTOR_ID;

    await TestDatabaseManager.connect();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    await TestDatabaseManager.getInstance().user.create({
      data: {
        id: SYSTEM_ACTOR_ID,
        email: 'system.actor@e2e.local',
        password: 'sem-login',
        type: 'PROFESSIONAL',
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  it('rejects unauthenticated access to protected routes with the real envelope', async () => {
    const response = await request(app.getHttpServer() as App).get(
      '/account/me',
    );
    expectErrorEnvelope(response, { status: 401, code: 'SESSION_MISSING' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('applies the same pre-auth CSRF/origin policy as the compiled process', async () => {
    const response = await request(app.getHttpServer() as App)
      .post('/auth/sessions')
      .set('Content-Type', 'application/json')
      .send({});
    expect(response.status).toBe(403);
    const body = response.body as { statusCode: number; code: string };
    expect(body.statusCode).toBe(403);
    expect(typeof body.code).toBe('string');
  });

  it('serializes validation failures through the production pipe and filter', async () => {
    const response = await request(app.getHttpServer() as App)
      .post('/admin/provisioning/organizations')
      .set(PROVISIONING_HEADER, PROVISIONING_KEY)
      .send({
        organization: { name: '', taxId: '' },
        administrator: { email: 'invalid', fullName: '' },
      });
    expectErrorEnvelope(response, {
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: ['organization.name', 'administrator.email'],
    });
  });

  it('rejects provisioning without a valid administrative key', async () => {
    await request(app.getHttpServer() as App)
      .post('/admin/provisioning/organizations')
      .send({
        organization: { name: '', taxId: '' },
        administrator: { email: 'invalid', fullName: '' },
      })
      .expect(401);
    expect(await TestDatabaseManager.getInstance().organization.count()).toBe(
      0,
    );
  });

  it('validates provisioning input without creating a record', async () => {
    await request(app.getHttpServer() as App)
      .post('/admin/provisioning/organizations')
      .set(PROVISIONING_HEADER, PROVISIONING_KEY)
      .send({
        organization: { name: '', taxId: '' },
        administrator: { email: 'invalid', fullName: '' },
      })
      .expect(400);
    expect(await TestDatabaseManager.getInstance().organization.count()).toBe(
      0,
    );
  });

  it('provisions an organization and rejects duplicate registration', async () => {
    const input = {
      organization: { name: 'HTTP test organization', taxId: '12345678000190' },
      administrator: {
        email: 'admin@http-test.dev',
        fullName: 'Admin HTTP Test',
      },
    };
    await request(app.getHttpServer() as App)
      .post('/admin/provisioning/organizations')
      .set(PROVISIONING_HEADER, PROVISIONING_KEY)
      .send(input)
      .expect(201);
    expect(
      await TestDatabaseManager.getInstance().organization.findUnique({
        where: { name: input.organization.name },
      }),
    ).toMatchObject(input.organization);
    await request(app.getHttpServer() as App)
      .post('/admin/provisioning/organizations')
      .set(PROVISIONING_HEADER, PROVISIONING_KEY)
      .send(input)
      .expect(409);
  });
});
