import { Membership, Prisma } from "@prisma/client";
import { BaseFactory } from "./base.factory";

export class MembershipFactory extends BaseFactory<Membership> {
    protected getDefaultData(): Partial<Membership> {
        return {}
    }

    async create(overrides: Partial<Membership> = {}): Promise<Membership> {
        return this.prisma.membership.create({
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.MembershipCreateInput
        });
    }
}