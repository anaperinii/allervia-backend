import { Test, TestingModule } from "@nestjs/testing"
import { UpdateRoleUseCase } from "../../update-role.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { UpdateRoleDto } from "src/account/roles/application/dtos/update-role.dto";
import { RoleNotFoundException } from "src/account/roles/domain/exceptions/role-not-found.exception";
import { IRoleRepository } from "src/account/roles/domain/contracts/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";
import { ulid } from "ulid";

describe('UpdateRoleUseCase - Integration', () => {
    let module: TestingModule;
    let updateRoleUseCase: UpdateRoleUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                UpdateRoleUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IRoleRepository,
                    useClass: PrismaRoleRepository
                }
            ]
        }).compile();

        updateRoleUseCase = module.get(UpdateRoleUseCase);
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

    it('should update role correctly', async () => {
        const organization = await factories.organizations.create();
        const role = await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: organization.id,
                isActive: true
            }
        });

        const dto: UpdateRoleDto = {
            description: 'Descrição Atualizada'
        };

        const result = await updateRoleUseCase.execute(role.id, dto, organization.id);

        expect(result).toBeDefined();
        expect(result.description).toBe(dto.description);
    });

    it('should throw not found exception when role does not exist', async () => {
        const organization = await factories.organizations.create();

        const dto: UpdateRoleDto = {
            description: 'Descrição Atualizada'
        };

        await expect(updateRoleUseCase.execute(ulid(), dto, organization.id)).rejects.toThrow(RoleNotFoundException);
    });
})

