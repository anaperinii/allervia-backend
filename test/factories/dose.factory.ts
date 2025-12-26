import { Dose, Prisma } from "@prisma/client";
import { BaseFactory } from "./base.factory";

export class DoseFactory extends BaseFactory<Dose> {
    protected getDefaultData(): Partial<Dose> {
        return {
            concentration: 10000,
            volume: 0.1,
            nextIntervalInDays: 7
        }
    }

    async create(overrides: Partial<Dose> = {}): Promise<Dose> {
        return this.prisma.dose.create({
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.DoseCreateInput
        });
    }
}