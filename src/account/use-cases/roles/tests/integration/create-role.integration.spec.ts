import { Test, TestingModule } from "@nestjs/testing"
import { CreateRoleUseCase } from "../../create-role.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { CreateRoleDto } from "src/account/dtos/roles/create-role.dto";
import { IRoleRepository } from "src/account/domain/interfaces/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";

describe('CreateRoleUseCase - Integration', () => {
    let module: TestingModule;
    let createRoleUseCase: CreateRoleUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateRoleUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IRoleRepository,
                    useClass: PrismaRoleRepository
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'SUPER_ADMIN_REGISTRATION_KEY') {
                                return 'test-secret-key';
                            }
                            return null;
                        })
                    }
                }
            ]
        }).compile();

        createRoleUseCase = module.get(CreateRoleUseCase);
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

    it('should create role correctly', async () => {
        const organization = await factories.organizations.create();

        const dto: CreateRoleDto = {
            name: 'PHYSICIAN',
            description: 'Médico',
            organizationId: organization.id,
            key: 'test-secret-key'
        };

        const result = await createRoleUseCase.execute(dto);

        expect(result).toBeDefined();
        expect(result.name).toBe(dto.name);
        expect(result.description).toBe(dto.description);
    });

    it('should throw unauthorized exception when key is invalid', async () => {
        const organization = await factories.organizations.create();

        const dto: CreateRoleDto = {
            name: 'PHYSICIAN',
            description: 'Médico',
            organizationId: organization.id,
            key: 'invalid-key'
        };

        await expect(createRoleUseCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    });
})

