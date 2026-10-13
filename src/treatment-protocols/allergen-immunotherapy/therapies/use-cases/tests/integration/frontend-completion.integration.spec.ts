import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import {
  StatusHistoryService,
  statusBuckets,
} from '../../../status-history.service';
import { ClinicalHistoryService } from '../../../clinical-history.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

describe('Frontend completion FE-08/10 - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let factories: TestFactories;
  let metrics: StatusHistoryService;
  let records: ClinicalHistoryService;
  let physician: AuthenticatedUserPayload;
  beforeAll(async () => {
    await TestDatabaseManager.connect();
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(TestDatabaseManager.getInstance())
      .compile();
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
    metrics = module.get(StatusHistoryService);
    records = module.get(ClinicalHistoryService);
  });
  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();
  });
  afterAll(async () => {
    await module.close();
    await TestDatabaseManager.disconnect();
  });

  async function therapy() {
    const patient = await factories.patients.create({
      organizationId: physician.organizationId,
      responsiblePhysicianId: physician.professionalId!,
      createdById: physician.id,
      updatedById: physician.id,
      birthDate: new Date('1990-01-01'),
      cpf: null,
    });
    const therapy = await factories.immunotherapies.create({
      patientId: patient.id,
      createdById: physician.id,
      updatedById: physician.id,
      inductionStartDate: new Date('2026-01-01T13:00:00Z'),
      createdAt: new Date('2026-01-01T13:00:00Z'),
    });
    return { patient, therapy };
  }
  const query = {
    from: '2026-01-01',
    to: '2026-04-30',
    timeZone: 'America/Sao_Paulo',
    granularity: 'month' as const,
  };

  it('reconstructs creation, suspension, resumption and completion at bucket close', async () => {
    const data = await therapy();
    await prisma.therapyLifecycleEvent.createMany({
      data: [
        {
          immunotherapyId: data.therapy.id,
          type: 'SUSPENSION',
          reason: 'Clinical suspension',
          createdById: physician.id,
          createdAt: new Date('2026-02-01T13:00:00Z'),
        },
        {
          immunotherapyId: data.therapy.id,
          type: 'RESUMPTION',
          reason: 'Clinical resumption',
          createdById: physician.id,
          createdAt: new Date('2026-03-01T13:00:00Z'),
        },
        {
          immunotherapyId: data.therapy.id,
          type: 'COMPLETION',
          reason: 'Clinical completion',
          createdById: physician.id,
          createdAt: new Date('2026-04-01T13:00:00Z'),
        },
      ],
    });
    await prisma.immunotherapy.update({
      where: { id: data.therapy.id },
      data: { status: 'COMPLETED' },
    });
    const result = await metrics.read(query, physician);
    expect(
      result.buckets.map(({ active, suspended, completed }) => [
        active,
        suspended,
        completed,
      ]),
    ).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('keeps other patients and organizations outside the physician aggregate', async () => {
    await therapy();
    const other =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const patient = await factories.patients.create({
      organizationId: other.organizationId,
      responsiblePhysicianId: other.professionalId!,
      createdById: other.id,
      updatedById: other.id,
    });
    await factories.immunotherapies.create({
      patientId: patient.id,
      createdById: other.id,
      updatedById: other.id,
      inductionStartDate: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
    });
    expect((await metrics.read(query, physician)).totalTherapies).toBe(1);
    await expect(records.record(patient.id, physician)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('uses clinical timezone at a month boundary and exposes unknown legacy histories', async () => {
    const data = await therapy();
    await prisma.therapyLifecycleEvent.create({
      data: {
        immunotherapyId: data.therapy.id,
        type: 'SUSPENSION',
        reason: 'Clinical suspension',
        createdById: physician.id,
        createdAt: new Date('2026-02-01T01:00:00Z'),
      },
    });
    expect((await metrics.read(query, physician)).buckets[0].suspended).toBe(1);
    expect(
      (await metrics.read({ ...query, timeZone: 'UTC' }, physician)).buckets[0]
        .suspended,
    ).toBe(0);
    await prisma.therapyLifecycleEvent.deleteMany();
    await prisma.immunotherapy.update({
      where: { id: data.therapy.id },
      data: { status: 'SUSPENDED' },
    });
    expect((await metrics.read(query, physician)).buckets[0]).toMatchObject({
      active: 0,
      suspended: 0,
      unknown: 1,
    });
  });

  it('rejects impossible dates and invalid timezones', () => {
    expect(() =>
      statusBuckets({ ...query, from: '2026-02-30' }, new Date()),
    ).toThrow();
    expect(() =>
      statusBuckets({ ...query, timeZone: 'Invalid/Zone' }, new Date()),
    ).toThrow();
  });

  it('does not disclose patient or guardian CPF to a clinical reader without patient update permission', async () => {
    const data = await therapy();
    await prisma.patient.update({
      where: { id: data.patient.id },
      data: {
        cpf: '52998224725',
        guardianCpf: '12345678909',
        guardianName: 'Synthetic guardian',
        guardianPhoneNumber: '11999999999',
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: physician.organizationId,
        userId: physician.id,
        entityType: 'Patient',
        entityId: data.patient.id,
        action: 'PATIENT_UPDATED',
        changedFields: ['cpf'],
        newValues: {
          cpf: '52998224725',
          nested: { guardianCpf: '12345678909' },
        },
      },
    });
    const createdNurse = await factories.users.createAuthenticatedNurse();
    await prisma.professional.update({
      where: { id: createdNurse.professionalId! },
      data: { organizationId: physician.organizationId },
    });
    const nurse = { ...createdNurse, organizationId: physician.organizationId };
    const result = await records.record(data.patient.id, nurse);
    expect(result.patient.cpf).toBeNull();
    expect(result.patient.guardianCpf).toBeNull();
    expect(result.redactedFields).toContain('patient.cpf');
    expect(JSON.stringify(result)).not.toContain('52998224725');
    expect(JSON.stringify(result)).not.toContain('12345678909');
    expect((await records.record(data.patient.id, physician)).patient.cpf).toBe(
      '52998224725',
    );
  });

  it('returns the full authorized clinical record beyond 200 events and multiple therapies', async () => {
    const data = await therapy();
    await factories.immunotherapies.create({
      patientId: data.patient.id,
      createdById: physician.id,
      updatedById: physician.id,
      inductionStartDate: new Date('2026-02-01'),
    });
    const dose = await factories.doses.create({
      immunotherapyId: data.therapy.id,
      createdById: physician.id,
      updatedById: physician.id,
      scheduledAt: new Date('2026-01-01T13:00:00Z'),
      status: 'ENTERED_IN_ERROR',
      administeredAt: new Date('2026-01-01T13:00:00Z'),
    });
    await prisma.doseObservation.create({
      data: {
        doseId: dose.id,
        phase: 'POST_ADMINISTRATION',
        reportedSideEffects: ['Synthetic symptom'],
        administeredMedications: [],
        notes: 'Original observation',
      },
    });
    await prisma.doseObservationAddendum.create({
      data: {
        doseId: dose.id,
        reportedSideEffects: ['Synthetic late symptom'],
        administeredMedications: [],
        notes: 'Immutable addendum',
        observedAt: new Date('2026-01-01T14:00:00Z'),
        createdById: physician.id,
      },
    });
    await prisma.auditLog.createMany({
      data: Array.from({ length: 201 }, (_, index) => ({
        organizationId: physician.organizationId,
        userId: physician.id,
        entityType: 'Dose',
        entityId: dose.id,
        action: 'SYNTHETIC_TEST',
        changedFields: [],
        newValues: { index },
      })),
    });
    const result = await records.record(data.patient.id, physician);
    expect(result.complete).toBe(true);
    expect(result.therapies).toHaveLength(2);
    expect(result.history).toHaveLength(201);
    const recordDose = result.therapies.flatMap((therapy) => therapy.doses)[0];
    expect(recordDose.status).toBe('ENTERED_IN_ERROR');
    expect(recordDose.observations[0].notes).toBe('Original observation');
    expect(recordDose.observationAddenda[0].notes).toBe('Immutable addendum');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });
});
