import { Test, TestingModule } from "@nestjs/testing"
import { CreateOrganizationUseCase } from "src/organization/use-cases/create-organization.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { CreateOrganizationDto } from "src/organization/dtos/create-organization.dto";
import { ConflictException } from "@nestjs/common";
import { OrganizationRepository } from "src/organization/organization.repository";
import { PrismaOrganizationRepository } from "src/organization/prisma-organization.repository";


describe('CreateOrganizationUseCase - Integration', () => {
    let module: TestingModule;
    let createOrganizationUseCase: CreateOrganizationUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateOrganizationUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: OrganizationRepository,
                    useClass: PrismaOrganizationRepository
                }
            ]
        }).compile();

        createOrganizationUseCase = module.get(CreateOrganizationUseCase);
        prisma = module.get(PrismaService);
        factories = new TestFactories(prisma);
    });

    beforeEach(async () => {
        await TestDatabaseManager.cleanAll();
    });

    afterAll(async () => {
        if(module) {
            await module.close();
        }
        await TestDatabaseManager.disconnect();
    });

    it('should create organization correctly', async () => {
        const dto: CreateOrganizationDto = {
            name: 'Organização Teste',
            taxId: '12345678000190'
        };

        const result = await createOrganizationUseCase.execute(dto);

        expect(result).toBeDefined();
        expect(result.name).toBe(dto.name);
        expect(result.taxId).toBe(dto.taxId);
    });

    it('should throw exception when organization with same name exists', async () => {
        const existingOrg = await factories.organizations.create({
            name: 'Organização Existente'
        });

        const dto: CreateOrganizationDto = {
            name: existingOrg.name,
            taxId: '98765432000110'
        };

        await expect(createOrganizationUseCase.execute(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw exception when organization with same taxId exists', async () => {
        const existingOrg = await factories.organizations.create({
            taxId: '12345678000190'
        });

        const dto: CreateOrganizationDto = {
            name: 'Nova Organização',
            taxId: existingOrg.taxId
        };

        await expect(createOrganizationUseCase.execute(dto)).rejects.toThrow(ConflictException);
    });
})


