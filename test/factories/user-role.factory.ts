import { Prisma, UserRole } from "@prisma/client";
import { BaseFactory } from "./base.factory";

export class UserRoleFactory extends BaseFactory<UserRole> {
    protected getDefaultData(): Partial<UserRole> {
        return {
            roleTag: 'PHYSICIAN'
        }
    }

    async create(overrides: Partial<UserRole> = {}): Promise<UserRole> {
        return this.prisma.userRole.create({
            data: {
            ...this.getDefaultData(),
            ...overrides
            } as Prisma.UserRoleCreateInput
        });
    }
}