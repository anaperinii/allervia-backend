import { Test, TestingModule } from "@nestjs/testing"
import { LoginUseCase } from "src/security/use-cases/login.use-case";
import { PrismaService } from "src/infra/database/prisma.service";
import { TestFactories } from "test/factories";
import { TestDatabaseManager } from "test/database/test-database.manager";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import * as bcrypt from 'bcrypt';
import { TokenGeneratorFactory } from "src/security/factories/token-generator.factory";
import { IUserAuthRepository } from "src/security/interfaces/user-auth.repository.interface";
import { IJwtTokenService } from "src/security/interfaces/jwt-token.service.interface";
import { IPasswordHashingService } from "src/security/interfaces/password-hashing.service.interface";
import { LoginDto } from "src/security/dtos/login.dto";
import { BcryptPasswordHashingService } from "src/security/bcrypt-password-hashing.service";
import { NestJwtTokenService } from "src/security/jwt-token.service";
import { PrismaUserAuthRepository } from "src/security/prisma-user-auth.repository";

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

