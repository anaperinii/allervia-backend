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
        birthDate: new Date('1990-01-01'),
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

  it('records the export request with author, cut and filters only once', async () => {
    await create.execute(createInput(physician, 'Trilha'), physician);
    const asOf = new Date().toISOString();
    await exporter.export({ asOf, page: 1, pageSize: 1 }, physician);
    await exporter.export({ asOf, page: 2, pageSize: 1 }, physician);
    const logs = await prisma.auditLog.findMany({
      where: { action: 'EXPORT_GENERATED' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(physician.id);
    expect(logs[0].newValues).toMatchObject({
      kind: 'CLINICAL_DOSES',
      asOf,
      rowCount: 1,
    });
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
