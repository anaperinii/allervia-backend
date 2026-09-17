import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { DomainExceptionFilter } from 'src/infra/filters/domain-exception.filter';
import { TestDatabaseManager } from './database/test-database.manager';

describe('Application HTTP contracts (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
  });

  it('rejects unauthenticated access to protected routes', () => {
    return request(app.getHttpServer()).get('/account/me').expect(401);
  });

  it('validates public registration input without creating a record', async () => {
    await request(app.getHttpServer())
      .post('/organization/register')
      .send({ name: '', taxId: '', unexpected: true })
      .expect(400);
    expect(await TestDatabaseManager.getInstance().organization.count()).toBe(
      0,
    );
  });

  it('registers an organization and rejects duplicate registration', async () => {
    const input = { name: 'HTTP test organization', taxId: '12345678000190' };
    await request(app.getHttpServer())
      .post('/organization/register')
      .send(input)
      .expect(201);
    expect(
      await TestDatabaseManager.getInstance().organization.findUnique({
        where: { name: input.name },
      }),
    ).toMatchObject(input);
    await request(app.getHttpServer())
      .post('/organization/register')
      .send(input)
      .expect(409);
  });
});
