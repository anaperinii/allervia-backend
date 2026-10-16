import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ProtocolCatalogService } from '../../../../protocol-catalog/protocol-catalog.service';
import { ConfiguredDoseService } from '../../../../dosing/configured-dose.service';
import { DoseCorrectionService } from '../../../../dosing/dose-correction.service';
import { CreateImmunotherapyUseCase } from '../../create-immunotherapy.use-case';
import { ClinicalExportService } from '../../../clinical-export.service';
import { ClinicalHistoryService } from '../../../clinical-history.service';
import { ListAuditLogsUseCase } from 'src/audit/use-cases/list-audit-logs.use-case';
import type { CreateImmunotherapyDto } from '../../../dtos/create-immunotherapy.dto';

describe('Clinical export and authorized history - Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let catalog: ProtocolCatalogService;
  let clinical: ConfiguredDoseService;
  let correction: DoseCorrectionService;
  let exporter: ClinicalExportService;
  let history: ClinicalHistoryService;
  let auditList: ListAuditLogsUseCase;
  let create: CreateImmunotherapyUseCase;
  let factories: TestFactories;
  let physician: AuthenticatedUserPayload;
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
    correction = module.get(DoseCorrectionService);
    exporter = module.get(ClinicalExportService);
    history = module.get(ClinicalHistoryService);
    auditList = module.get(ListAuditLogsUseCase);
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
  function createInput(
    actor: AuthenticatedUserPayload,
    fullName: string,
  ): CreateImmunotherapyDto {
    sequence += 1;
    return {
      idempotencyKey: `export-${sequence}`,
      patient: {
        fullName,
        birthDate: '1990-01-01',
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: actor.professionalId!,
      },
      immunoType: 'Synthetic',
      administrationRoute: 'SUBCUTANEOUS',
      extract: 'Synthetic extract',
      inductionStartDate: '2026-01-01T13:00:00Z',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
    };
  }
  async function administerFirst(doseId: string) {
    sequence += 1;
    return clinical.administer(
      doseId,
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
        idempotencyKey: `export-cmd-${sequence}`,
        betweenDosesReport: '',
      },
      physician,
    ) as Promise<{ successor: { id: string } | null }>;
  }

  it('freezes the export set at the temporal cut, separating planned and administered', async () => {
    const result = await create.execute(
      createInput(physician, 'Paciente Export'),
      physician,
    );
    const beforeAnything = new Date(Date.now() - 60_000).toISOString();
    const afterFirstDose = new Date().toISOString();
    await administerFirst(result.firstDose.id);

    const empty = await exporter.export(
      { asOf: beforeAnything, page: 1, pageSize: 50 },
      physician,
    );
    expect(empty.total).toBe(0);

    const cut = await exporter.export(
      { asOf: afterFirstDose, page: 1, pageSize: 50 },
      physician,
    );
    expect(cut.total).toBe(1);
    const row = cut.items[0];
    expect(row.planned).toMatchObject({ volume: '0.1' });
    expect(row.administered).toMatchObject({ volume: '0.1' });
    expect(row.status).toBe('ADMINISTERED_ON_SCHEDULE');
    expect(row.prescription).toMatchObject({
      versionId,
      protocolName: 'Synthetic test protocol',
      versionNumber: 1,
      timeZone: 'America/Sao_Paulo',
    });
    expect(row.patient.fullName).toBe('Paciente Export');
    expect(row.therapy.immunoType).toBe('Synthetic');

    const now = await exporter.export(
      { asOf: new Date().toISOString(), page: 1, pageSize: 50 },
      physician,
    );
    expect(now.total).toBe(2);
  });

  it('records every export page with author, cut, pagination and justification', async () => {
    await create.execute(createInput(physician, 'Trilha'), physician);
    const asOf = new Date().toISOString();
    await exporter.export(
      { asOf, page: 1, pageSize: 1, justification: 'Auditoria clínica LGPD.' },
      physician,
    );
    await exporter.export(
      { asOf, page: 2, pageSize: 1, justification: 'Auditoria clínica LGPD.' },
      physician,
    );
    const logs = await prisma.auditLog.findMany({
      where: { action: 'EXPORT_GENERATED' },
    });
    expect(logs).toHaveLength(2);
    const pages = logs.map(
      (log) => (log.newValues as Record<string, unknown>).page,
    );
    expect(pages.sort()).toEqual([1, 2]);
    const first = logs.find(
      (log) => (log.newValues as Record<string, unknown>).page === 1,
    )!;
    const second = logs.find(
      (log) => (log.newValues as Record<string, unknown>).page === 2,
    )!;
    expect(first.userId).toBe(physician.id);
    expect(first.newValues).toMatchObject({
      kind: 'CLINICAL_DOSES',
      asOf,
      page: 1,
      pageSize: 1,
      rows: 1,
      rowCount: 1,
      justification: 'Auditoria clínica LGPD.',
    });
    expect(second.newValues).toMatchObject({
      page: 2,
      rows: 0,
      rowCount: 1,
      justification: 'Auditoria clínica LGPD.',
    });
  });

  it('freezes membership across pages at the same asOf while rows carry current values', async () => {
    const therapyA = await create.execute(
      createInput(physician, 'Terapia A'),
      physician,
    );
    const administeredA = await administerFirst(therapyA.firstDose.id);
    const therapyB = await create.execute(
      createInput(physician, 'Terapia B'),
      physician,
    );
    const administeredB = await administerFirst(therapyB.firstDose.id);
    const successorB = administeredB.successor!.id;
    const asOf = new Date().toISOString();

    const page1 = await exporter.export(
      { asOf, page: 1, pageSize: 2 },
      physician,
    );
    expect(page1.total).toBe(4);
    expect(page1.items.map((row) => row.doseId)).toEqual([
      therapyA.firstDose.id,
      administeredA.successor!.id,
    ]);

    const successorA = administeredA.successor!.id;
    const doseA2 = await prisma.dose.findUniqueOrThrow({
      where: { id: successorA },
      select: { revision: true, immunotherapy: { select: { revision: true } } },
    });
    sequence += 1;
    await clinical.administer(
      successorA,
      {
        values: {
          concentration: '1000',
          volume: '0.2',
          intervalDays: 7,
          stepId: 'middle',
        },
        administeredAt: new Date().toISOString(),
        expectedRevision: doseA2.revision,
        expectedTherapyRevision: doseA2.immunotherapy.revision,
        idempotencyKey: `export-cmd-${sequence}`,
        betweenDosesReport: '',
        reason: 'Paciente antecipou a aplicação.',
      },
      physician,
    );
    const doseB1 = await prisma.dose.findUniqueOrThrow({
      where: { id: therapyB.firstDose.id },
      select: { revision: true, immunotherapy: { select: { revision: true } } },
    });
    await correction.retract(
      therapyB.firstDose.id,
      {
        reason: 'Registro em erro.',
        expectedRevision: doseB1.revision,
        expectedTherapyRevision: doseB1.immunotherapy.revision,
      },
      physician,
    );

    const page2 = await exporter.export(
      { asOf, page: 2, pageSize: 2 },
      physician,
    );
    expect(page2.total).toBe(4);
    expect(page2.items.map((row) => row.doseId)).toEqual([
      therapyB.firstDose.id,
      successorB,
    ]);
    const retracted = page2.items.find(
      (row) => row.doseId === therapyB.firstDose.id,
    )!;
    expect(retracted.status).toBe('ENTERED_IN_ERROR');
    expect(retracted.administered).toMatchObject({ volume: '0.1' });

    const freshCut = await exporter.export(
      { asOf: new Date().toISOString(), page: 1, pageSize: 50 },
      physician,
    );
    expect(freshCut.total).toBe(6);
  });

  it('issues a server cut on the first page and requires its reuse for subsequent pages', async () => {
    const before = Date.now();
    const first = await exporter.export({ page: 1 }, physician);
    expect(Date.parse(first.asOf)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(first.asOf)).toBeLessThanOrEqual(Date.now());
    const second = await exporter.export(
      { page: 2, asOf: first.asOf },
      physician,
    );
    expect(second.asOf).toBe(first.asOf);
    await expect(exporter.export({ page: 2 }, physician)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('scopes the export by physician and organization and rejects a future cut', async () => {
    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );
    const outsider =
      await factories.users.createAuthenticatedPhysicianProfessional();
    await create.execute(createInput(physician, 'Do Titular'), physician);
    await create.execute(createInput(colleague, 'Do Colega'), colleague);
    const asOf = new Date().toISOString();

    expect((await exporter.export({ asOf }, physician)).total).toBe(1);
    expect(
      (await exporter.export({ asOf }, physician)).items[0].patient.fullName,
    ).toBe('Do Titular');
    expect((await exporter.export({ asOf }, outsider)).total).toBe(0);

    await expect(
      exporter.export(
        { asOf: new Date(Date.now() + 3_600_000).toISOString() },
        physician,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('serves the clinical history by therapy scope without opening the whole audit trail', async () => {
    const nurse = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['NURSE'],
    );
    const otherPhysician = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );
    const result = await create.execute(
      createInput(physician, 'Histórico'),
      physician,
    );
    await administerFirst(result.firstDose.id);
    const therapyId = result.immunotherapy.id;

    const trail = await history.history(therapyId, physician);
    const actions = trail.entries.map((entry) => entry.action);
    expect(actions).toContain('PRESCRIPTION_CREATED');
    expect(actions).toContain('DOSE_ADMINISTERED');
    expect(trail.entries[0].user.professional?.fullName).toBeDefined();

    expect((await history.history(therapyId, nurse)).entries.length).toBe(
      trail.entries.length,
    );
    await expect(history.history(therapyId, otherPhysician)).rejects.toThrow(
      NotFoundException,
    );

    await expect(auditList.execute({}, physician)).rejects.toThrow(
      NotFoundException,
    );
  });
});
