import { InternalUserInvite, Prisma } from "@prisma/client";
import { BaseFactory } from "./base.factory";
import { faker } from "@faker-js/faker";
import { ulid } from "ulid";

export class InternalUserInviteFactory extends BaseFactory<InternalUserInvite> {
    protected getDefaultData(): Partial<InternalUserInvite> {
        return {
            email: faker.internet.email(),
            fullName: faker.person.fullName(),
            roleType: 'PHYSICIAN',
            token: ulid()
        }
    }

    async create(overrides: Partial<InternalUserInvite> = {}): Promise<InternalUserInvite> {
        return this.prisma.internalUserInvite.create({
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.InternalUserInviteCreateInput
        });
    }
}