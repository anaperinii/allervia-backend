import { GoogleCalendarConnection, Prisma } from '@prisma/client';
import { BaseFactory } from './base.factory';
import { faker } from '@faker-js/faker';

export class GoogleCalendarConnectionFactory extends BaseFactory<GoogleCalendarConnection> {
  protected getDefaultData(): Partial<GoogleCalendarConnection> {
    return {
      googleAccountEmail: faker.internet.email(),
      calendarId: 'primary',
      grantedScopes: 'https://www.googleapis.com/auth/calendar.events',
      refreshTokenCiphertext: faker.string.alphanumeric(48),
      refreshTokenIv: faker.string.alphanumeric(16),
      refreshTokenAuthTag: faker.string.alphanumeric(22),
      keyVersion: 1,
      status: 'ACTIVE',
    };
  }

  async create(
    overrides: Partial<GoogleCalendarConnection> = {},
  ): Promise<GoogleCalendarConnection> {
    return this.prisma.googleCalendarConnection.create({
      data: {
        ...this.getDefaultData(),
        ...overrides,
      } as Prisma.GoogleCalendarConnectionUncheckedCreateInput,
    });
  }
}
