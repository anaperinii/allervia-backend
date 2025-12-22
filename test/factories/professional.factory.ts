import { Prisma, Professional } from "@prisma/client";
import { BaseFactory } from "./base.factory";
import { faker } from '@faker-js/faker'

export class ProfessionalFactory extends BaseFactory<Professional> {
    protected getDefaultData(): Partial<Professional> {
        return {
            specialty: faker.helpers.arrayElement(['Alergia e Imunologia', 'Pediatria', 'Enfermagem e Aplicação de Imunoterapias']),
            phoneNumber: faker.phone.number()
        }
    }

    async create(overrides: Partial<Professional> = {}): Promise<Professional> {
        return this.prisma.professional.create({
            data: {
                ...this.getDefaultData(),
                ...overrides,
            } as Prisma.ProfessionalCreateInput
        });
    }
    
}