import { HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { TestDatabaseManager } from 'test/database/test-database.manager';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService - Integração com PostgreSQL', () => {
  let prisma: PrismaService;
  let service: RateLimitService;

  beforeAll(async () => {
    await TestDatabaseManager.connect();
    prisma = TestDatabaseManager.getInstance() as unknown as PrismaService;
    service = new RateLimitService(prisma);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.rateLimitCounter.deleteMany({});
  });

  afterAll(async () => {
    await TestDatabaseManager.disconnect();
  });

  it('duas chamadas concorrentes com limite 1 permitem exatamente uma', async () => {
    const options = {
      class: 'public-submit',
      key: 'it:concurrency-pair',
      limit: 1,
      windowSeconds: 60,
    };

    const [first, second] = await Promise.all([
      service.consume(options),
      service.consume(options),
    ]);

    const allowedCount = [first, second].filter((r) => r.allowed).length;
    expect(allowedCount).toBe(1);

    const denied = [first, second].find((r) => !r.allowed);
    expect(denied?.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(denied?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('dez chamadas concorrentes com limite 5 permitem exatamente cinco', async () => {
    const options = {
      class: 'public-submit',
      key: 'it:concurrency-burst',
      limit: 5,
      windowSeconds: 60,
    };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.consume(options)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);

    const row = await prisma.rateLimitCounter.findUnique({
      where: { key: options.key },
    });
    expect(row?.count).toBe(6);
  });

  it('reinicia a contagem na fronteira da janela expirada', async () => {
    const options = {
      class: 'public-submit',
      key: 'it:window-boundary',
      limit: 2,
      windowSeconds: 60,
    };

    await service.consume(options);
    await service.consume(options);
    const denied = await service.consume(options);
    expect(denied.allowed).toBe(false);

    const past = new Date(Date.now() - 1_000);
    await prisma.rateLimitCounter.update({
      where: { key: options.key },
      data: { expiresAt: past, windowStartsAt: new Date(Date.now() - 61_000) },
    });

    const afterBoundary = await service.consume(options);
    expect(afterBoundary.allowed).toBe(true);

    const row = await prisma.rateLimitCounter.findUnique({
      where: { key: options.key },
    });
    expect(row?.count).toBe(1);
    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('mantém a janela original enquanto não expira', async () => {
    const options = {
      class: 'public-submit',
      key: 'it:window-stable',
      limit: 10,
      windowSeconds: 60,
    };

    await service.consume(options);
    const first = await prisma.rateLimitCounter.findUnique({
      where: { key: options.key },
    });

    await service.consume(options);
    const second = await prisma.rateLimitCounter.findUnique({
      where: { key: options.key },
    });

    expect(second?.count).toBe(2);
    expect(second?.windowStartsAt.getTime()).toBe(
      first?.windowStartsAt.getTime(),
    );
    expect(second?.expiresAt.getTime()).toBe(first?.expiresAt.getTime());
  });

  it('falha de armazenamento fecha por padrão e abre com failOpen', async () => {
    const failingPrisma = {
      $queryRaw: () => Promise.reject(new Error('storage down')),
    } as unknown as PrismaService;
    const failingService = new RateLimitService(failingPrisma);

    const closedError: unknown = await failingService
      .consume({
        class: 'public-submit',
        key: 'it:storage-closed',
        limit: 5,
        windowSeconds: 60,
      })
      .catch((caught: unknown) => caught);

    expect(closedError).toBeInstanceOf(CodedHttpException);
    expect((closedError as CodedHttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    await expect(
      failingService.consume({
        class: 'export',
        key: 'it:storage-open',
        limit: 5,
        windowSeconds: 60,
        failOpen: true,
      }),
    ).resolves.toEqual({ allowed: true });
  });
});
