import { AdministrationRoute, Immunotherapy, Prisma } from "@prisma/client";
import { BaseFactory } from "./base.factory";

export class ImmunotherapyFactory extends BaseFactory<Immunotherapy> {
    protected getDefaultData(): Partial<Immunotherapy> {
        return {
            immunoType: 'Ácaros',
            administrationRoute: 'SUBCUTANEOUS' as AdministrationRoute,
            extract: "Der p 60 + der f 10% + blt 30%",
            targetConcentration: 10,
            targetVolume: 0.5
        }
    }

    async create(overrides: Partial<Immunotherapy> = {}): Promise<Immunotherapy> {
        return this.prisma.immunotherapy.create({
            data: {
                ...this.getDefaultData(),
                ...overrides
            } as Prisma.ImmunotherapyCreateInput
        });
    }
}