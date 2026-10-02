import { Appointment, Prisma } from '@prisma/client';
import { BaseFactory } from './base.factory';
import { faker } from '@faker-js/faker';

export class AppointmentFactory extends BaseFactory<Appointment> {
  protected getDefaultData(): Partial<Appointment> {
    const startsAt = faker.date.soon({ days: 10 });
    return {
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status: 'SCHEDULED',
    };
  }

  async create(overrides: Partial<Appointment> = {}): Promise<Appointment> {
    return this.prisma.appointment.create({
      data: {
        ...this.getDefaultData(),
        ...overrides,
      } as Prisma.AppointmentUncheckedCreateInput,
    });
  }
}
