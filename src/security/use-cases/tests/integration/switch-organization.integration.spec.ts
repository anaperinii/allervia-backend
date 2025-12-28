import { Test, TestingModule } from "@nestjs/testing"
import { SwitchOrganizationUseCase } from "../../switch-organization.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SwitchOrganizationDto } from "src/security/dtos/switch-organization.dto";
import { TokenGeneratorFactory } from "src/security/factories/token-generator.factory";
import { IUserAuthRepository } from "src/security/interfaces/user-auth.repository.interface";
import { PrismaUserAuthRepository } from "src/security/infrastructure/repositories/prisma-user-auth.repository";
import { IJwtTokenService } from "src/security/interfaces/jwt-token.service.interface";
import { NestJwtTokenService } from "src/security/infrastructure/jwt/jwt-token.service";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/repositories/prisma-membership.repository";
import { IMembershipRepository } from "src/memberships/domain/interfaces/membership.repository.interface";
import { JwtModule } from "@nestjs/jwt";

describe('SwitchOrganizationUseCase - Integration', () => {
    let module: TestingModule;
    let switchOrganizationUseCase: SwitchOrganizationUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            imports: [
                JwtModule.register({
                    secret: 'test-secret',
                    signOptions: { expiresIn: '1h' }
                })
            ],
            providers: [
                SwitchOrganizationUseCase,
                TokenGeneratorFactory,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserAuthRepository,
                    useClass: PrismaUserAuthRepository
                },
                {
                    provide: IJwtTokenService,
                    useClass: NestJwtTokenService
                }, 
                {
                    provide: IMembershipRepository,
                    useClass: PrismaMembershipRepository
                }
            ]
        }).compile();

        switchOrganizationUseCase = module.get(SwitchOrganizationUseCase);
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

    it('should switch organization correctly for admin user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();
        await factories.memberships.create({
            userId: authenticatedUser.id,
            organizationId: organization.id
        });

        const dto: SwitchOrganizationDto = {
            organizationId: organization.id
        };

        const result = await switchOrganizationUseCase.execute(dto, {
            ...authenticatedUser,
            memberships: [{
                organizationId: organization.id,
                organizationName: organization.name
            }]
        });

        expect(result).toBeDefined();
        expect(result.access_token).toBeDefined();
    });

    it('should throw bad request exception for professional user', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedPhysicianProfessional();
        const organization = await factories.organizations.create();

        const dto: SwitchOrganizationDto = {
            organizationId: organization.id
        };

        await expect(switchOrganizationUseCase.execute(dto, authenticatedUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw forbidden exception when user does not have access to organization', async () => {
        const authenticatedUser = await factories.users.createAuthenticatedAdmin();
        const organization = await factories.organizations.create();

        const dto: SwitchOrganizationDto = {
            organizationId: organization.id
        };

        await expect(switchOrganizationUseCase.execute(dto, authenticatedUser)).rejects.toThrow(ForbiddenException);
    });
})


