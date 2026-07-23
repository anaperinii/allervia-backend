import { Test, TestingModule } from "@nestjs/testing"
import { CreateInviteUseCase } from "../../create-invite.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { FindUserByIdUseCase } from "src/account/use-cases/users/find-user-by-id.use-case";
import { ValidateUserEmailUseCase } from "src/account/use-cases/users/validate-user-email.use-case";
import { FindActiveInviteUseCase } from "../../find-active-invite.use-case";
import { IUserRepository } from "src/account/user.repository";
import { PrismaUserRepository } from "src/account/prisma-user.repository";
import { ConflictException } from "@nestjs/common";
import { IUserInviteRepository } from "src/onboarding/domain/interfaces/user-invite.repository.interface";
import { PrismaUserInviteRepository } from "src/onboarding/prisma-user-invite.repository";
import { CreateInviteDto } from "../../../dtos/create-invite.dto";
import { AdminInviteStrategy } from "../../../strategies/invites/admin-invite.strategy";
import { InviteStrategyContext } from "../../../strategies/invites/invite-strategy.context";
import { InviteStrategyFactory } from "../../../strategies/invites/invite-strategy.factory";


describe('CreateInviteUseCase - Integration', () => {
    let module: TestingModule;
    let createInviteUseCase: CreateInviteUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateInviteUseCase,
                InviteStrategyContext,
                InviteStrategyFactory,
                AdminInviteStrategy,
                FindUserByIdUseCase,
                ValidateUserEmailUseCase,
                FindActiveInviteUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserInviteRepository,
                    useClass: PrismaUserInviteRepository
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                }
            ]
        }).compile();

        createInviteUseCase = module.get(CreateInviteUseCase);
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

    it('should create invite correctly', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const dto: CreateInviteDto = {
            email: 'newuser@test.com',
            fullName: 'Novo Usuário',
            userRole: 'PHYSICIAN'
        };

        const result = await createInviteUseCase.execute(dto, authenticatedUser);

        expect(result).toBeDefined();
        expect(result.email).toBe(dto.email);
        expect(result.fullName).toBe(dto.fullName);
        expect(result.role).toBe(dto.userRole);
        expect(result.organizationId).toBe(authenticatedUser.activeOrgId);
    });

    it('should throw conflict exception when active invite already exists', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            email: 'existing@test.com',
            isActive: true,
            expiresAt: new Date('2026-01-01'),
            createdById: authenticatedUser.id
        });

        const dto: CreateInviteDto = {
            email: invite.email,
            fullName: 'Novo Usuário',
            userRole: 'PHYSICIAN'
        };

        await expect(createInviteUseCase.execute(dto, authenticatedUser)).rejects.toThrow(ConflictException);
    });

    it('should throw exception when user already exists and is active', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const existingUser = await factories.users.create({
            email: 'existing@test.com',
            isActive: true
        });

        const dto: CreateInviteDto = {
            email: existingUser.email,
            fullName: 'Novo Usuário',
            userRole: 'PHYSICIAN'
        };

        await expect(createInviteUseCase.execute(dto, authenticatedUser)).rejects.toThrow(ConflictException);
    });
})


