import { Test, TestingModule } from "@nestjs/testing"
import { FindInviteByIdUseCase } from "src/invites/use-cases/find-invite-by-id.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { ulid } from "ulid";
import { IUserInviteRepository } from "src/invites/domain/interfaces/user-invite.repository.interface";
import { NotFoundException } from "@nestjs/common";
import { PrismaUserInviteRepository } from "src/invites/prisma-user-invite.repository";

describe('FindInviteByIdUseCase - Integration', () => {
    let module: TestingModule;
    let findInviteByIdUseCase: FindInviteByIdUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                FindInviteByIdUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserInviteRepository,
                    useClass: PrismaUserInviteRepository
                }
            ]
        }).compile();

        findInviteByIdUseCase = module.get(FindInviteByIdUseCase);
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

    it('should return invite correctly by id', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            organizationId: authenticatedUser.activeOrgId,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const result = await findInviteByIdUseCase.execute(invite.id, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.id).toBe(invite.id);
        expect(result.email).toBe(invite.email);
    });

    it('should throw not found exception when invite does not exist', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        await expect(findInviteByIdUseCase.execute(ulid(), authenticatedUser)).rejects.toThrow(NotFoundException);
    });
})


