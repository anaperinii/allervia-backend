import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from 'src/treatment-protocols/allergen-immunotherapy/dosing/configured-dose.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { NotificationsService } from '../notifications.service';
import { PublicRequestsService } from 'src/public-requests/public-requests.service';
import type { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';

describe('Notifications outbox and persisted requests - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let notifications: NotificationsService;
  let requests: PublicRequestsService;
  let create: CreateImmunotherapyUseCase;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;
  let nurse: AuthenticatedUserPayload;
  let versionId: string;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    catalog = module.get(ProtocolCatalogService);
    clinical = module.get(ConfiguredDoseService);
    notifications = module.get(NotificationsService);
    requests = module.get(PublicRequestsService);
    create = module.get(CreateImmunotherapyUseCase);
    factories = new TestFactories(prisma);
  });
  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });
  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
    nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const created = await catalog.create(
      {
        name: 'Synthetic test protocol',
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

  let sequence = 0;
  async function administeredWithReviewRequest() {
    sequence += 1;
    const input: CreateImmunotherapyDto = {
      idempotencyKey: `notify-${sequence}`,
      patient: {
        fullName: `Paciente ${sequence}`,
        birthDate: '1990-01-01',
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: physician.professionalId!,
      },
      immunoType: 'Synthetic',
      administrationRoute: 'SUBCUTANEOUS',
      extract: 'Synthetic extract',
      inductionStartDate: '2026-01-01T13:00:00Z',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
    const result = await create.execute(input, physician);
    await clinical.administer(
      result.firstDose.id,
      {
        values: {
          concentration: '1000',
          volume: '0.1',
          intervalDays: 7,
          stepId: 'low',
        },
        administeredAt: '2026-01-01T13:00:00Z',
        expectedRevision: 0,
        expectedTherapyRevision: 0,
        idempotencyKey: `notify-cmd-${sequence}`,
        betweenDosesReport: '',
        immediateConduct: {
          type: 'REQUEST_PHYSICIAN_REVIEW',
          justification: 'Eritema extenso; avaliar prescrição.',
        },
      },
      nurse,
    );
    return result;
  }

  it('writes the outbox event in the same commit and materializes it idempotently', async () => {
    const result = await administeredWithReviewRequest();
    const events = await prisma.outboxEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('PHYSICIAN_REVIEW_REQUESTED');
    expect(events[0].processedAt).toBeNull();

    const first = await notifications.processPending();
    expect(first).toEqual({ processed: 1, failed: 0 });
    const second = await notifications.processPending();
    expect(second).toEqual({ processed: 0, failed: 0 });
    expect(await prisma.notification.count()).toBe(1);

    const inbox = await notifications.list({}, physician);
    expect(inbox.total).toBe(1);
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0].title).toBe('Avaliação médica solicitada');
    expect(inbox.items[0].entityId).toBe(result.immunotherapy.id);
    expect((await notifications.list({}, nurse)).total).toBe(0);
  });

  it('respects recipient preferences without losing the event record', async () => {
    await notifications.setPreference(
      'PHYSICIAN_REVIEW_REQUESTED',
      false,
      physician,
    );
    await administeredWithReviewRequest();
    await notifications.processPending();
    expect(await prisma.notification.count()).toBe(0);
    const event = await prisma.outboxEvent.findFirstOrThrow();
    expect(event.processedAt).not.toBeNull();
    const preferences = await notifications.preferences(physician);
    expect(preferences).toContainEqual({
      kind: 'PHYSICIAN_REVIEW_REQUESTED',
      enabled: false,
    });
  });

  it('scopes reading and marking to the recipient', async () => {
    await administeredWithReviewRequest();
    await notifications.processPending();
    const inbox = await notifications.list({}, physician);
    const id = inbox.items[0].id;

    await expect(notifications.markRead(id, nurse)).rejects.toThrow(
      NotFoundException,
    );
    const read = await notifications.markRead(id, physician);
    expect(read.readAt).not.toBeNull();
    expect((await notifications.list({}, physician)).unread).toBe(0);
    expect(await notifications.markAllRead(physician)).toEqual({ marked: 0 });
  });

  it('exposes outbox status with attempts and failures to administration', async () => {
    await administeredWithReviewRequest();
    await prisma.outboxEvent.create({
      data: {
        organizationId: physician.organizationId,
        kind: 'PHYSICIAN_REVIEW_REQUESTED',
        payload: { recipientProfessionalId: 'missing' },
        attempts: 5,
        lastError: 'simulated failure',
      },
    });
    await notifications.processPending();
    const status = await notifications.outboxStatus(physician);
    expect(status.pending).toBe(1);
    expect(status.deadLettered).toBe(1);
    expect(status.lastFailures[0].lastError).toBe('simulated failure');
  });

  it('claims each event once across concurrent workers and never duplicates the notification', async () => {
    await administeredWithReviewRequest();
    await prisma.outboxEvent.updateMany({
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    const [a, b] = await Promise.all([
      notifications.processPending(),
      notifications.processPending(),
    ]);
    expect(a.processed + b.processed).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
    expect(
      (await prisma.outboxEvent.findFirstOrThrow()).processedAt,
    ).not.toBeNull();
  });

  it('fences a worker that lost ownership after a restart', async () => {
    await administeredWithReviewRequest();
    const event = await prisma.outboxEvent.findFirstOrThrow();
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        leaseUntil: new Date(Date.now() + 60_000),
        attemptId: 'stale-worker',
      },
    });
    expect(await notifications.processPending()).toEqual({
      processed: 0,
      failed: 0,
    });

    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    expect(await notifications.processPending()).toEqual({
      processed: 1,
      failed: 0,
    });
    const reclaimed = await prisma.outboxEvent.findFirstOrThrow();
    expect(reclaimed.processedAt).not.toBeNull();
    expect(reclaimed.attemptId).not.toBe('stale-worker');
    const lateWrite = await prisma.outboxEvent.updateMany({
      where: { id: event.id, attemptId: 'stale-worker' },
      data: { processedAt: null, lastError: 'stale overwrite' },
    });
    expect(lateWrite.count).toBe(0);
  });

  it('backs off on failure and keeps the exhausted event consultable until an authorized retry', async () => {
    const malformed = await prisma.outboxEvent.create({
      data: {
        organizationId: physician.organizationId,
        kind: 'PHYSICIAN_REVIEW_REQUESTED',
        payload: Prisma.JsonNull,
      },
    });
    expect(await notifications.processPending()).toEqual({
      processed: 0,
      failed: 1,
    });
    const failedOnce = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: malformed.id },
    });
    expect(failedOnce.attempts).toBe(1);
    expect(failedOnce.lastError).not.toBeNull();
    expect(failedOnce.leaseUntil).toBeNull();
    expect(failedOnce.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notifications.processPending()).toEqual({
      processed: 0,
      failed: 0,
    });

    await prisma.outboxEvent.update({
      where: { id: malformed.id },
      data: { attempts: 5, nextAttemptAt: new Date(0) },
    });
    expect(await notifications.processPending()).toEqual({
      processed: 0,
      failed: 0,
    });
    expect((await notifications.outboxStatus(physician)).deadLettered).toBe(1);

    await prisma.outboxEvent.update({
      where: { id: malformed.id },
      data: {
        payload: {
          therapyId: 'therapy-1',
          patientId: 'patient-1',
          patientName: 'Paciente Retry',
          reason: 'Reprocessamento autorizado',
          recipientProfessionalId: physician.professionalId!,
        },
      },
    });
    const retried = await notifications.retryOutboxEvent(
      malformed.id,
      physician,
    );
    expect(retried).toEqual({ requeued: true, id: malformed.id });
    const requeued = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: malformed.id },
    });
    expect(requeued.attempts).toBe(0);
    expect(requeued.processedAt).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: malformed.id },
    });
    expect(audit.action).toBe('OUTBOX_EVENT_REQUEUED');
    expect(audit.userId).toBe(physician.id);

    expect(await notifications.processPending()).toEqual({
      processed: 1,
      failed: 0,
    });
    expect(await prisma.notification.count()).toBe(1);
  });

  it('rejects retry of events that are not terminally failed', async () => {
    await administeredWithReviewRequest();
    const event = await prisma.outboxEvent.findFirstOrThrow();
    await expect(
      notifications.retryOutboxEvent(event.id, physician),
    ).rejects.toThrow(ConflictException);
    await notifications.processPending();
    await expect(
      notifications.retryOutboxEvent(event.id, physician),
    ).rejects.toThrow(ConflictException);
    await expect(
      notifications.retryOutboxEvent('01J0000000000000000000FAKE', physician),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists public contact and authenticated support requests with confirmation', async () => {
    const contact = await requests.createContactRequest({
      name: 'Interessada',
      email: 'contato@example.com',
      organization: 'Clínica Nova',
      message: 'Quero conhecer o produto.',
    });
    expect(contact.received).toBe(true);
    expect(contact.status).toBe('RECEIVED');
    expect(await prisma.contactRequest.count()).toBe(1);

    const support = await requests.createSupportRequest(
      { subject: 'Dúvida na agenda', message: 'Como registro falta?' },
      physician,
    );
    expect(support.received).toBe(true);
    const mine = await requests.listSupportRequests(physician);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toBe('Dúvida na agenda');
    expect(await requests.listSupportRequests(nurse)).toHaveLength(0);
  });
});
