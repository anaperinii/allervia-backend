import { Patient, Prisma } from '@prisma/client';
import { BaseFactory } from './base.factory';
import { faker } from '@faker-js/faker';

export class PatientFactory extends BaseFactory<Patient> {
  protected getDefaultData(): Partial<Patient> {
    return {
      fullName: faker.person.fullName(),
      birthDate: faker.date.birthdate(),
      weightInKg: faker.number.float({ min: 40.0, max: 98.0 }),
      phoneNumber: faker.phone.number(),
    };
  }

  async create(overrides: Partial<Patient> = {}): Promise<Patient> {
    return this.prisma.patient.create({
      data: {
        ...this.getDefaultData(),
        ...overrides,
      } as Prisma.PatientCreateInput,
    });
  }
}
