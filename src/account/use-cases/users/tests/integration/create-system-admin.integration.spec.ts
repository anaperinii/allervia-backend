import { Test, TestingModule } from "@nestjs/testing"
import { CreateSystemAdminUseCase } from "../../create-system-admin.use-case";
import { PrismaService } from "src/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { PrismaUserRepository } from "src/account/prisma-user.repository";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { IPasswordHashingService } from "src/security/interfaces/password-hashing.service.interface";
import { BcryptPasswordHashingService } from "src/security/bcrypt-password-hashing.service";
import { IUserRepository } from "src/account/user.repository";
import { UserAlreadyExistsException } from "src/account/exceptions/users/user-already-exists.exception";
import { ProfileSystemUserDto } from "src/account/dtos/users/profile-system-user.dto";

describe('CreateSystemAdminUseCase - Integration', () => {
    let module: TestingModule;
    let createSystemAdminUseCase: CreateSystemAdminUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;
    let configService: ConfigService;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            providers: [
                CreateSystemAdminUseCase,
                {
                    provide: PrismaService,
                    useValue: TestDatabaseManager.getInstance()
                },
                {
                    provide: IUserRepository,
                    useClass: PrismaUserRepository
                },
                {
                    provide: IPasswordHashingService,
                    useClass: BcryptPasswordHashingService,
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

        createSystemAdminUseCase = module.get(CreateSystemAdminUseCase);
        prisma = module.get(PrismaService);
        factories = new TestFactories(prisma);
        configService = module.get(ConfigService);
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

    it('should create system admin correctly', async () => {
        const dto: ProfileSystemUserDto = {
            fullName: 'System Admin Test',
            email: 'systemadmin@test.com',
            password: 'password123',
            key: 'test-secret-key'
        };

        await factories.roles.create({
            name: 'SYSTEM_ADMIN'
        })

        const result = await createSystemAdminUseCase.execute(dto);

        expect(result).toBeDefined();
        expect(result.email).toBe(dto.email);
        expect(result.fullName).toBe(dto.fullName);
        expect(result.type).toBe('SYSTEM_ADMIN');
    });

    it('should throw unauthorized exception when key is invalid', async () => {
        const dto: ProfileSystemUserDto = {
            fullName: 'System Admin Test',
            email: 'systemadmin@test.com',
            password: 'password123',
            key: 'invalid-key'
        };

        await expect(createSystemAdminUseCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw user already exists exception when email already exists', async () => {
        const existingUser = await factories.users.create({
            email: 'existing@test.com',
            type: 'SYSTEM_ADMIN'
        });

        const dto: ProfileSystemUserDto = {
            fullName: 'System Admin Test',
            email: existingUser.email,
            password: 'password123',
            key: 'test-secret-key'
        };

        await expect(createSystemAdminUseCase.execute(dto)).rejects.toThrow(UserAlreadyExistsException);
    });
})

