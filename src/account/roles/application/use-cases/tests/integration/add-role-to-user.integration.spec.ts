import { Test, TestingModule } from "@nestjs/testing"
import { AddRoleToUserUseCase } from "../../add-role-to-user.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { FindUserByIdUseCase } from "src/account/profiles/application/use-cases/find-user-by-id.use-case";
import { FindRoleByNameUseCase } from "../../find-role-by-name.use-case";
import { FindUserRoleByNameUseCase } from "../../find-user-role-by-name.use-case";
import { IUserRepository } from "src/account/profiles/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/profiles/infrastructure/persistence/prisma-user.repository";
import { ConflictException } from "@nestjs/common";
import { InactiveRoleException } from "src/account/roles/domain/exceptions/inactive-role.exception";
import { IRoleRepository } from "src/account/roles/domain/contracts/role.repository.interface";
import { PrismaRoleRepository } from "src/account/roles/infrastructure/persistence/prisma-role.repository";

describe('AddRoleToUserUseCase - Integration', () => {
    let module: TestingModule;
    let addRoleToUserUseCase: AddRoleToUserUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                AddRoleToUserUseCase,
                FindUserByIdUseCase,
                FindRoleByNameUseCase,
                FindUserRoleByNameUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                },
                {
                    provide: IRoleRepository,
                    useClass: PrismaRoleRepository
                }
            ]
        }).compile();

        addRoleToUserUseCase = module.get(AddRoleToUserUseCase);
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

    it('should add role to user correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: authenticatedUser.activeOrgId,
                isActive: true
            }
        });

        await addRoleToUserUseCase.execute(targetUser.id, 'PHYSICIAN', authenticatedUser.activeOrgId);

        const userRole = await prisma.userRole.findFirst({
            where: {
                userId: targetUser.id,
                roleTag: 'PHYSICIAN'
            }
        });

        expect(userRole).toBeDefined();
    });

    it('should throw conflict exception when user already has the role', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: authenticatedUser.activeOrgId,
                isActive: true
            }
        });

        await addRoleToUserUseCase.execute(targetUser.id, 'PHYSICIAN', authenticatedUser.activeOrgId);

        await expect(addRoleToUserUseCase.execute(targetUser.id, 'PHYSICIAN', authenticatedUser.activeOrgId)).rejects.toThrow(ConflictException);
    });

    it('should throw exception when role is inactive', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        
        const targetUser = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId
        });

        await prisma.role.create({
            data: {
                name: 'PHYSICIAN',
                organizationId: authenticatedUser.activeOrgId,
                isActive: false
            }
        });

        await expect(addRoleToUserUseCase.execute(targetUser.id, 'PHYSICIAN', authenticatedUser.activeOrgId)).rejects.toThrow(InactiveRoleException);
    });
})

