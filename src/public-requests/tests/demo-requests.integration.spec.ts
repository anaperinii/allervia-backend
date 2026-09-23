import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IEmailService } from 'src/infra/email/email.service';
import { buildValidationPipe } from 'src/infra/http/validation-pipe';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { DemoEmailDispatcher } from '../demo-email.dispatcher';

const form = () => ({
  requestId: randomUUID(),
  name: 'Pessoa',
  lastName: 'Sintética',
  email: 'synthetic@example.com',
  phone: '11999999999',
  role: 'doctor',
  solution: 'single_clinic',
  specialty: 'Alergologia',
  professionals: 3,
});

describe('Demo request HTTP and durable email - Integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let dispatcher: DemoEmailDispatcher;
  const send = jest.fn();
  const oldRecipient = process.env.DEMO_REQUEST_EMAIL_TO;

  beforeAll(async () => {
    process.env.DEMO_REQUEST_EMAIL_TO = 'team@example.invalid';
    await TestDatabaseManager.connect();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .overrideProvider(IEmailService)
      .useValue({ sendDemoRequest: send })
      .compile();
    prisma = module.get(PrismaService);
    dispatcher = module.get(DemoEmailDispatcher);
    app = module.createNestApplication();
    app.useGlobalPipes(buildValidationPipe());
    await app.init();
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    send.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (app) await app.close();
    await TestDatabaseManager.disconnect();
    if (oldRecipient === undefined) delete process.env.DEMO_REQUEST_EMAIL_TO;
    else process.env.DEMO_REQUEST_EMAIL_TO = oldRecipient;
  });

  it('persists every field before acknowledgement and queues a notification to the configured team', async () => {
    const input = form();
    const response = await request(app.getHttpServer())
      .post('/demo-requests')
      .send(input)
      .expect(202);
    const receipt = response.body as {
      received: boolean;
      id: string;
      createdAt: string;
    };
    expect(Object.keys(receipt).sort()).toEqual([
      'createdAt',
      'id',
      'received',
    ]);
    expect(receipt.received).toBe(true);
    expect(typeof receipt.id).toBe('string');
    expect(typeof receipt.createdAt).toBe('string');
    expect(send).not.toHaveBeenCalled();
    const saved = await prisma.demoRequest.findFirstOrThrow();
    expect(saved).toMatchObject(input);
    expect(saved.emailNextAttemptAt).not.toBeNull();
    await dispatcher.processPending();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ ...input, to: 'team@example.invalid' }),
    );
    expect(
      (await prisma.demoRequest.findFirstOrThrow()).emailAcceptedAt,
    ).not.toBeNull();
    await dispatcher.processPending();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent replays and rejects a changed payload using the same key', async () => {
    const input = form();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app.getHttpServer())
          .post('/demo-requests')
          .send(input)
          .expect(202),
      ),
    );
    expect(
      new Set(responses.map((r) => (r.body as { id: string }).id)).size,
    ).toBe(1);
    expect(await prisma.demoRequest.count()).toBe(1);
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send({ ...input, name: 'Outra' })
      .expect(409);
  });

  it.each([
    { professionals: '3' },
    { professionals: 0 },
    { professionals: 1.5 },
    { role: 'administrator' },
    { solution: 'invalid' },
    { phone: '123' },
    { email: 'invalid' },
    { name: ' ' },
    { specialty: ' ' },
    { to: 'attacker@example.com' },
    { requestId: 'not-a-uuid' },
  ])('rejects invalid or extra fields without persisting %j', async (patch) => {
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send({ ...form(), ...patch })
      .expect(400);
    expect(await prisma.demoRequest.count()).toBe(0);
  });

  it('limits repeated submissions without blocking an idempotent replay', async () => {
    const input = form();
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(input)
      .expect(202);
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/demo-requests')
        .send(form())
        .expect(202);
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(form())
      .expect(429);
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(input)
      .expect(202);
  });

  it('retains SMTP failures without exposing errors and retries after backoff', async () => {
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(form())
      .expect(202);
    send.mockRejectedValueOnce(
      new Error('Sensitive SMTP diagnostic must not be persisted'),
    );
    await dispatcher.processPending();
    const failed = await prisma.demoRequest.findFirstOrThrow();
    expect(failed).toMatchObject({
      emailAcceptedAt: null,
      emailAttempts: 1,
      emailErrorCode: 'SMTP_SEND_FAILED',
    });
    expect(failed.emailNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    await dispatcher.processPending();
    expect(send).toHaveBeenCalledTimes(1);
    await prisma.demoRequest.update({
      where: { id: failed.id },
      data: { emailNextAttemptAt: new Date(0) },
    });
    await dispatcher.processPending();
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      (await prisma.demoRequest.findFirstOrThrow()).emailErrorCode,
    ).toBeNull();
  });

  it('claims each job once across concurrent workers and recovers an expired lease', async () => {
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(form())
      .expect(202);
    await prisma.demoRequest.updateMany({
      data: { emailLeaseUntil: new Date(Date.now() - 1000) },
    });
    await Promise.all([
      dispatcher.processPending(),
      dispatcher.processPending(),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retains exhausted jobs for inspection instead of retrying forever', async () => {
    await request(app.getHttpServer())
      .post('/demo-requests')
      .send(form())
      .expect(202);
    await prisma.demoRequest.updateMany({ data: { emailAttempts: 7 } });
    send.mockRejectedValue(new Error('SMTP unavailable'));
    await dispatcher.processPending();
    expect(await prisma.demoRequest.findFirstOrThrow()).toMatchObject({
      emailAttempts: 8,
      emailNextAttemptAt: null,
      emailAcceptedAt: null,
      emailErrorCode: 'RETRY_EXHAUSTED',
    });
    await dispatcher.processPending();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
