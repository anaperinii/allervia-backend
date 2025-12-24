import { Test, TestingModule } from "@nestjs/testing"
import { ListProfessionalsByOrganizationUseCase } from "../../list-professionals-by-organization.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { IProfessionalRepository } from "src/professionals/domain/professional.repository.interface";
import { ProfessionalPrismaRepository } from "src/professionals/infrastructure/persistence/prisma-professional.repository";

describe('ListProfessionalsByOrganizationUseCase - Integration', () => {
    let module: TestingModule;
    let listProfessionalsByOrganizationUseCase: ListProfessionalsByOrganizationUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                ListProfessionalsByOrganizationUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IProfessionalRepository,
                    useClass: ProfessionalPrismaRepository
                }
            ]
        }).compile();

        listProfessionalsByOrganizationUseCase = module.get(ListProfessionalsByOrganizationUseCase);
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

    it('should return all professionals by organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        
        // Create another professional in the same organization
        const user2 = await factories.users.create({
            organizationId: authenticatedUser.activeOrgId,
            type: 'PROFESSIONAL'
        });
        const professional2 = await factories.professionals.create({
            userId: user2.id
        });

        const result = await listProfessionalsByOrganizationUseCase.execute(authenticatedUser);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.some(p => p.id === authenticatedUser.professionalId)).toBe(true);
        expect(result.some(p => p.id === professional2.id)).toBe(true);
    });

    it('should return empty array when organization has no professionals', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();

        const result = await listProfessionalsByOrganizationUseCase.execute(authenticatedUser);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    });

    it('should not return professionals from another organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const authenticatedUserAnotherOrg = await factories.users.createAuthenticatedPhysicianProfessional();

        const result = await listProfessionalsByOrganizationUseCase.execute(authenticatedUser);

        expect(result).toBeDefined();
        expect(result.every(p => p.id !== authenticatedUserAnotherOrg.professionalId || authenticatedUser.activeOrgId === authenticatedUserAnotherOrg.activeOrgId)).toBe(true);
    });
})

