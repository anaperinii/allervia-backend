import { Prisma, User } from "@prisma/client";
import { BaseFactory } from "./base.factory";
import { faker } from '@faker-js/faker';
import { AuthenticatedUserPayload } from "src/security/types/auth.types";

export class UserFactory extends BaseFactory<User> {
    // Fornece campos que não possuem valor default e não são opcionais no schema
    protected getDefaultData(): Partial<User> {
        return {
            fullName: faker.person.fullName(),
            email: faker.internet.email(),
            password: 'hashed_password',
            type: 'PROFESSIONAL'
        }
    }

    async create(overrides: Partial<User> = {}): Promise<User> {
        return this.prisma.user.create({ 
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.UserCreateInput 
        });
    }

    async createAuthenticatedPhysicianProfessional(overrides?: Partial<AuthenticatedUserPayload>): Promise<AuthenticatedUserPayload> {

        const organization = await this.prisma.organization.create({
            data: {
                name: faker.company.name(),
                taxId: faker.string.numeric(14)
            }
        });

        const user = await this.create({
            organizationId: organization.id,
            specialty: faker.helpers.arrayElement(['Alergia e Imunologia', 'Pediatria', 'Enfermagem e Aplicação de Imunoterapias']),
            phoneNumber: faker.phone.number(),
        });

        return {
            id: user.id,
            email: user.email,
            type: 'PROFESSIONAL',
            activeOrgId: organization.id,
            roles: ['PHYSICIAN'],
            memberships: [],
        };
    }

    async createAuthenticatedAdmin(overrides?: Partial<AuthenticatedUserPayload>): Promise<AuthenticatedUserPayload> {

        const organization = await this.prisma.organization.create({
            data: {
                name: faker.company.name(),
                taxId: faker.string.numeric(14)
            }
        });

        const user = await this.create({ 
            type: 'ADMIN', 
            organizationId: organization.id ,
            phoneNumber: faker.phone.number()
        });

        return {
            id: user.id,
            email: user.email,
            type: 'ADMIN',
            activeOrgId: organization.id,
            roles: ['ADMIN'],
            memberships: [],
        };
    }

    async createAuthenticatedSystemAdmin(overrides?: Partial<AuthenticatedUserPayload>): Promise<AuthenticatedUserPayload> {
        const user = await this.create({ type: 'SYSTEM_ADMIN' });

        const organization = await this.prisma.organization.create({
            data: {
                name: faker.company.name(),
                taxId: faker.string.numeric(14)
            }
        });

        const membership = await this.prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: organization.id
            }
        })

        return {
            id: user.id,
            email: user.email,
            type: 'SYSTEM_ADMIN',
            activeOrgId: organization.id,
            roles: ['SYSTEM_ADMIN'],
            memberships: [
                {
                    id: membership.id,
                    organizationId: organization.id,
                    organizationName: organization.name,
                },
            ],
        };
    }
}