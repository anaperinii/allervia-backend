import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import type { CreateImmunotherapyDto } from 'src/treatment-protocols/allergen-immunotherapy/therapies/dtos/create-immunotherapy.dto';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { TestFactories } from 'test/factories';
import { syntheticProtocolDefinition } from 'test/fixtures/configured-protocol';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

describe('Cadastro de prescrição - idempotência e paciente existente', () => {
  let module: TestingModule;
  let prisma: PrismaService;
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
    create = module.get(CreateImmunotherapyUseCase);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
    physician =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const catalog = module.get(ProtocolCatalogService);
    const created = await catalog.create(
      { name: 'Protocolo I5', definition: syntheticProtocolDefinition() },
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
    if (module) await module.close();
    await TestDatabaseManager.disconnect();
  });

  function input(
    overrides: Partial<CreateImmunotherapyDto> = {},
  ): CreateImmunotherapyDto {
    return {
      idempotencyKey: 'intencao-1',
      patient: {
        fullName: 'Paciente Novo',
        birthDate: new Date('1990-01-01'),
        weightInKg: 70,
        phoneNumber: '11999999999',
        responsiblePhysicianId: physician.professionalId!,
      },
      immunoType: 'SCIT',
      administrationRoute: 'SUBCUTANEOUS',
      extract: 'Der p 100%',
      inductionStartDate: '2026-01-01T13:00:00Z',
      stepIds: ['low', 'middle', 'high'],
      startingStepId: 'low',
      targetStepId: 'high',
      ...overrides,
    };
  }

  it('repetir a requisição com a mesma chave e corpo não duplica o cadastro', async () => {
    const first = await create.execute(input(), physician);
    const replay = await create.execute(input(), physician);

    expect(replay.immunotherapy.id).toBe(first.immunotherapy.id);
    expect(replay.patient.id).toBe(first.patient.id);
    expect(replay.firstDose.id).toBe(first.firstDose.id);

    expect(await prisma.patient.count()).toBe(1);
    expect(await prisma.immunotherapy.count()).toBe(1);
    expect(await prisma.dose.count()).toBe(1);
    expect(await prisma.registrationCommand.count()).toBe(1);
  });

  it('mesma chave com corpo diferente é conflito, não cadastro novo', async () => {
    await create.execute(input(), physician);

    await expect(
      create.execute(input({ extract: 'Der f 100%' }), physician),
    ).rejects.toThrow(ConflictException);

    expect(await prisma.immunotherapy.count()).toBe(1);
  });

  it('falha não grava nada — nem paciente, nem comando', async () => {
    await expect(
      create.execute(input({ startingStepId: 'inexistente' }), physician),
    ).rejects.toThrow();

    expect(await prisma.patient.count()).toBe(0);
    expect(await prisma.immunotherapy.count()).toBe(0);
    expect(await prisma.registrationCommand.count()).toBe(0);
  });

  it('prescreve novo tratamento a paciente existente sem duplicá-lo', async () => {
    const first = await create.execute(input(), physician);

    const second = await create.execute(
      input({
        idempotencyKey: 'intencao-2',
        patient: undefined,
        patientId: first.patient.id,
        extract: 'Der f 100%',
      }),
      physician,
    );

    expect(second.patient.id).toBe(first.patient.id);
    expect(second.immunotherapy.id).not.toBe(first.immunotherapy.id);
    expect(await prisma.patient.count()).toBe(1);
    expect(await prisma.immunotherapy.count()).toBe(2);

    const doses = await prisma.dose.groupBy({
      by: ['immunotherapyId'],
      _count: true,
    });
    expect(doses).toHaveLength(2);
    expect(doses.every((group) => group._count === 1)).toBe(true);
  });

  it('exige exatamente um entre paciente novo e paciente existente', async () => {
    await expect(
      create.execute(input({ patientId: 'qualquer' }), physician),
    ).rejects.toThrow(BadRequestException);

    await expect(
      create.execute(
        input({ patient: undefined, patientId: undefined }),
        physician,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('não prescreve para paciente de outro responsável nem de outra organização', async () => {
    const first = await create.execute(input(), physician);

    const colleague = await factories.users.createColleagueWithRoles(
      physician.organizationId,
      ['PHYSICIAN'],
    );

    await expect(
      create.execute(
        input({
          idempotencyKey: 'intencao-3',
          patient: undefined,
          patientId: first.patient.id,
        }),
        colleague,
      ),
    ).rejects.toThrow(BadRequestException);

    const stranger =
      await factories.users.createAuthenticatedPhysicianProfessional();

    await expect(
      create.execute(
        input({
          idempotencyKey: 'intencao-4',
          patient: undefined,
          patientId: first.patient.id,
        }),
        stranger,
      ),
    ).rejects.toThrow();

    expect(await prisma.immunotherapy.count()).toBe(1);
  });

  it('troca do padrão durante o formulário não muda a versão selecionada', async () => {
    const catalog = module.get(ProtocolCatalogService);

    const chosenVersionId = versionId;

    const protocolId = (
      await prisma.protocolVersion.findUniqueOrThrow({
        where: { id: versionId },
        select: { protocolId: true },
      })
    ).protocolId;
    const v2 = await catalog.createVersion(
      protocolId,
      syntheticProtocolDefinition(),
      physician,
    );
    await catalog.mutate(v2.id, 0, physician, 'publish');
    await catalog.mutate(v2.id, 1, physician, 'default');

    const result = await create.execute(
      input({ protocolVersionId: chosenVersionId }),
      physician,
    );

    expect(result.immunotherapy.prescription.versionId).toBe(chosenVersionId);
    expect(result.immunotherapy.prescription.versionId).not.toBe(v2.id);
  });

  it('mantém o cadastro do paciente existente rejeitando paciente inativo', async () => {
    const first = await create.execute(input(), physician);
    await prisma.patient.update({
      where: { id: first.patient.id },
      data: { isActive: false },
    });

    await expect(
      create.execute(
        input({
          idempotencyKey: 'intencao-5',
          patient: undefined,
          patientId: first.patient.id,
        }),
        physician,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('paciente inexistente responde não encontrado sem vazar existência', async () => {
    await expect(
      create.execute(
        input({ patient: undefined, patientId: '01JUNKJUNKJUNKJUNKJUNKJUNK' }),
        physician,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
