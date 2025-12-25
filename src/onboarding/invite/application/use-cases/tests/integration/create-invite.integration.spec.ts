import { Test, TestingModule } from "@nestjs/testing"
import { CreateInviteUseCase } from "../../create-invite.use-case";
import { PrismaService } from "src/database/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { FindUserByIdUseCase } from "src/account/application/use-cases/find-user-by-id.use-case";
import { ValidateUserEmailUseCase } from "src/account/application/use-cases/validate-user-email.use-case";
import { FindActiveInviteUseCase } from "../../find-active-invite.use-case";
import { IUserRepository } from "src/account/domain/contracts/user.repository.interface";
import { PrismaUserRepository } from "src/account/infrastructure/persistence/prisma-user.repository";
import { ConflictException } from "@nestjs/common";
import { IUserInviteRepository } from "src/onboarding/invite/domain/contracts/user-invite.repository.interface";
import { EmailInviteAlreadyActiveException } from "src/onboarding/invite/domain/exceptions/email-invite-already-active.exception";
import { PrismaUserInviteRepository } from "src/onboarding/invite/infrastructure/persistence/prisma-user-invite.repository";
import { CreateInviteDto } from "../../../dtos/create-invite.dto";
import { AdminInviteStrategy } from "../../../strategies/admin-invite.strategy";
import { InviteStrategyContext } from "../../../strategies/invite-strategy.context";
import { InviteStrategyFactory } from "../../../strategies/invite-strategy.factory";
import { SystemAdminInviteStrategy } from "../../../strategies/system-admin-invite.strategy";


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
                SystemAdminInviteStrategy,
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
        expect(result.roleType).toBe(dto.userRole);
        expect(result.organizationId).toBe(authenticatedUser.activeOrgId);
    });

    it('should throw conflict exception when active invite already exists', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const invite = await factories.internalUserInvite.create({
            email: 'existing@test.com',
            organizationId: authenticatedUser.activeOrgId,
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
            organizationId: authenticatedUser.activeOrgId,
            email: 'existing@test.com',
            isActive: true
        });

        const dto: CreateInviteDto = {
            email: existingUser.email,
            fullName: 'Novo Usuário',
            userRole: 'PHYSICIAN'
        };

        await expect(createInviteUseCase.execute(dto, authenticatedUser)).rejects.toThrow(EmailInviteAlreadyActiveException);
    });
})

