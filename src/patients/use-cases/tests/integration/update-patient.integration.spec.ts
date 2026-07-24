import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePatientUseCase } from 'src/patients/use-cases/update-patient.use-case';
import { PrismaService } from 'src/infra/database/prisma.service';
import { TestFactories } from 'test/factories';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { PatientRepository } from 'src/patients/patient.repository';
import { PrismaPatientRepository } from 'src/patients/prisma-patient.repository';
import { ulid } from 'ulid';
import { NotFoundException } from '@nestjs/common';
import { UpdatePatientDto } from 'src/patients/dtos/update-patient.dto';

describe('UpdatePatientUseCase - Integration', () => {
  let module: TestingModule;
  let updatePatientUseCase: UpdatePatientUseCase;
  let prisma: PrismaService;
  let factories: TestFactories;

  beforeAll(async () => {
    await TestDatabaseManager.connect();

    module = await Test.createTestingModule({
      providers: [
        UpdatePatientUseCase,
        {
          provide: PrismaService,
          useValue: TestDatabaseManager.getInstance(),
        },
        {
          provide: PatientRepository,
          useClass: PrismaPatientRepository,
        },
      ],
    }).compile();

    updatePatientUseCase = module.get(UpdatePatientUseCase);
    prisma = module.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  beforeEach(async () => {
    await TestDatabaseManager.cleanAll();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    await TestDatabaseManager.disconnect();
  });

  it('should update patient correctly', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.activeOrgId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const dto: UpdatePatientDto = {
      fullName: 'João Silva Atualizado',
      weightInKg: 80.0,
      phoneNumber: '11999999999',
    };

    const result = await updatePatientUseCase.execute(
      patient.id,
      dto,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.fullName).toBe(dto.fullName);
    expect(result.weightInKg).toBe(dto.weightInKg);
    expect(result.phoneNumber).toBe(dto.phoneNumber);
  });

  it('should update patient partially', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.activeOrgId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const dto: UpdatePatientDto = {
      fullName: 'Nome Atualizado',
    };

    const result = await updatePatientUseCase.execute(
      patient.id,
      dto,
      authenticatedUser,
    );

    expect(result).toBeDefined();
    expect(result.fullName).toBe(dto.fullName);
  });

  it('should throw a not found exception when updating a non-existent patient', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const dto: UpdatePatientDto = {
      fullName: 'Nome Atualizado',
    };

    await expect(
      updatePatientUseCase.execute(ulid(), dto, authenticatedUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw a not found exception when updating patient from another organization', async () => {
    const authenticatedUser =
      await factories.users.createAuthenticatedPhysicianProfessional();
    const authenticatedUserAnotherOrg =
      await factories.users.createAuthenticatedPhysicianProfessional();

    const patient = await factories.patients.create({
      organizationId: authenticatedUser.activeOrgId,
      createdById: authenticatedUser.id,
      updatedById: authenticatedUser.id,
    });

    const dto: UpdatePatientDto = {
      fullName: 'Nome Atualizado',
    };

    await expect(
      updatePatientUseCase.execute(
        patient.id,
        dto,
        authenticatedUserAnotherOrg,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
