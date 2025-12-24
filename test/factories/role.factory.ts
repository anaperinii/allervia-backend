import { Prisma, Role } from "@prisma/client";
import { BaseFactory } from "./base.factory";

export class RoleFactory extends BaseFactory<Role> {
    protected getDefaultData(): Partial<Role> {
        return {}
    }

    async create(overrides: Partial<Role> = {}): Promise<Role> {
        return await this.prisma.role.create({
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.RoleCreateInput
        });
    }
}