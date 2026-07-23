import { Prisma, User } from "@prisma/client";
import { BaseFactory } from "./base.factory";
import { faker } from '@faker-js/faker';
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

export class UserFactory extends BaseFactory<User> {
    // Fornece campos sem default e não opcionais no schema (User = credencial/status)
    protected getDefaultData(): Partial<User> {
        return {
            email: faker.internet.email(),
            password: 'hashed_password',
            type: 'PROFESSIONAL',
        };
    }

    async create(overrides: Partial<User> = {}): Promise<User> {
        return this.prisma.user.create({
            data: {
                ...this.getDefaultData(),
                ...overrides,
            } as Prisma.UserCreateInput,
        });
    }

    private async createOrganization() {
        return this.prisma.organization.create({
            data: {
                name: faker.company.name(),
                taxId: faker.string.numeric(14),
            },
        });
    }

    private async createProfessionalUser(
        roles: string[],
    ): Promise<AuthenticatedUserPayload> {
        const organization = await this.createOrganization();
        const user = await this.create({ type: 'PROFESSIONAL' });

        const professional = await this.prisma.professional.create({
            data: {
                userId: user.id,
                organizationId: organization.id,
                fullName: faker.person.fullName(),
                phoneNumber: faker.phone.number(),
                profession: 'PHYSICIAN',
            },
        });

        return {
            id: user.id,
            email: user.email,
            type: 'PROFESSIONAL',
            activeOrgId: organization.id,
            professionalId: professional.id,
            roles,
        };
    }

    async createAuthenticatedPhysicianProfessional(): Promise<AuthenticatedUserPayload> {
        return this.createProfessionalUser(['PHYSICIAN']);
    }

    async createAuthenticatedAdmin(): Promise<AuthenticatedUserPayload> {
        return this.createProfessionalUser(['ADMINISTRATOR']);
    }
}
