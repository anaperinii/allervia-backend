import { PrismaClient } from '@prisma/client';

export abstract class BaseFactory<T> {
  constructor(protected prisma: PrismaClient) {}

  protected abstract getDefaultData(): Partial<T>;

  abstract create(overrides?: Partial<T>): Promise<T>;

  async createMany(count: number, overrides?: Partial<T>): Promise<T[]> {
    const promises = Array.from({ length: count }, () =>
      this.create(overrides),
    );
    return Promise.all(promises);
  }
}
