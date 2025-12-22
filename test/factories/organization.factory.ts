import { Organization, Prisma } from "@prisma/client";
import { BaseFactory } from "./base.factory";
import { faker } from '@faker-js/faker';

export class OrganizationFactory extends BaseFactory<Organization> {
    protected getDefaultData(): Partial<Organization> {
        return {
            name: faker.company.name(),
            taxId: faker.string.numeric(14)
        }
    }

    async create(overrides: Partial<Organization> = {}): Promise<Organization> {
        return this.prisma.organization.create({ 
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.OrganizationCreateInput
        });
    }
    
}