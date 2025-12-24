import { Test, TestingModule } from "@nestjs/testing"
import { LoginUseCase } from "../../login.use-case";
import { PrismaService } from "src/prisma/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import * as bcrypt from 'bcrypt';
import { TokenGeneratorFactory } from "src/security/application/factories/token-generator.factory";
import { IUserAuthRepository } from "src/security/domain/repositories/user-auth.repository.interface";
import { IJwtTokenService } from "src/security/domain/services/jwt-token.service.interface";
import { IPasswordHashingService } from "src/security/domain/services/password-hashing.service.interface";
import { LoginDto } from "src/security/dto/login.dto";
import { BcryptPasswordHashingService } from "src/security/infrastructure/cryptography/bcrypt-password-hashing.service";
import { NestJwtTokenService } from "src/security/infrastructure/jwt/jwt-token.service";
import { PrismaUserAuthRepository } from "src/security/infrastructure/persistence/prisma-user-auth.repository";
import { IMembershipRepository } from "src/memberships/domain/contracts/membership.repository.interface";
import { PrismaMembershipRepository } from "src/memberships/infrastructure/persistence/prisma-membership.repository";

describe('LoginUseCase - Integration', () => {
    let module: TestingModule;
    let loginUseCase: LoginUseCase;
    let prisma: PrismaService;
    let factories: TestFactories;

    beforeAll(async () => {

        await TestDatabaseManager.connect();

        module = await Test.createTestingModule({
            imports: [
                JwtModule.register({
                    secret: 'test-secret',
                    signOptions: { expiresIn: '1h' }
                }),
                ConfigModule.forRoot()
            ],
            providers: [
                LoginUseCase,
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
                    provide: IPasswordHashingService,
                    useClass: BcryptPasswordHashingService
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

        loginUseCase = module.get(LoginUseCase);
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

    it('should login user correctly with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);

        const organization = await factories.organizations.create();

        const user = await factories.users.create({
            email: 'test@example.com',
            password: hashedPassword,
            organizationId: organization.id
        });

        const dto: LoginDto = {
            email: user.email,
            password: 'password123'
        };

        const result = await loginUseCase.execute(dto);

        expect(result).toBeDefined();
        expect(result.access_token).toBeDefined();
    });

    it('should throw a bad request exception if an user of type professional dont have organization id', async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);

        const user = await factories.users.create({
            email: 'test@example.com',
            password: hashedPassword
        });

        const dto: LoginDto = {
            email: user.email,
            password: 'password123'
        };

        await expect(loginUseCase.execute(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw unauthorized exception when email does not exist', async () => {
        const dto: LoginDto = {
            email: 'nonexistent@example.com',
            password: 'password123'
        };

        await expect(loginUseCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw unauthorized exception when password is incorrect', async () => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const user = await factories.users.create({
            email: 'test@example.com',
            password: hashedPassword
        });

        const dto: LoginDto = {
            email: user.email,
            password: 'wrongpassword'
        };

        await expect(loginUseCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    });
})

