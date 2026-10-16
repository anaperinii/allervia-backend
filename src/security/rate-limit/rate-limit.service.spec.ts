import { HttpStatus } from '@nestjs/common';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { PrismaService } from 'src/infra/database/prisma.service';
import { RateLimitService } from './rate-limit.service';

interface PrismaMock {
  $queryRaw: jest.Mock;
  rateLimitCounter: { deleteMany: jest.Mock };
}

function createPrismaMock(): PrismaMock {
  return {
    $queryRaw: jest.fn(),
    rateLimitCounter: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function createService(prisma: PrismaMock): RateLimitService {
  return new RateLimitService(prisma as unknown as PrismaService);
}

const baseOptions = {
  class: 'public-submit',
  key: 'public-submit:abc',
  limit: 5,
  windowSeconds: 60,
};

describe('RateLimitService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('permite quando o contador fica dentro do limite', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 3, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    const service = createService(prisma);

    const result = await service.consume(baseOptions);

    expect(result).toEqual({ allowed: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('permite exatamente no limite', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 5, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    const service = createService(prisma);

    await expect(service.consume(baseOptions)).resolves.toEqual({
      allowed: true,
    });
  });

  it('nega acima do limite com retryAfterSeconds até o fim da janela', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 6, expiresAt: new Date(Date.now() + 30_000) },
    ]);
    const service = createService(prisma);

    const result = await service.consume(baseOptions);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(29);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(31);
  });

  it('nega com retryAfterSeconds mínimo de 1 segundo', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 6, expiresAt: new Date(Date.now() - 1) },
    ]);
    const service = createService(prisma);

    const result = await service.consume(baseOptions);

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('fecha por padrão quando o armazenamento falha', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const service = createService(prisma);

    const error: unknown = await service
      .consume(baseOptions)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CodedHttpException);
    expect((error as CodedHttpException).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as CodedHttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('abre com failOpen quando o armazenamento falha', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const service = createService(prisma);

    await expect(
      service.consume({ ...baseOptions, class: 'export', failOpen: true }),
    ).resolves.toEqual({ allowed: true });
  });

  it('trata resultado vazio como falha de armazenamento', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    const service = createService(prisma);

    await expect(service.consume(baseOptions)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    await expect(
      service.consume({ ...baseOptions, failOpen: true }),
    ).resolves.toEqual({ allowed: true });
  });

  it('dispara limpeza oportunista com throttle', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    const service = createService(prisma);

    let now = 1_000_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    await service.consume(baseOptions);
    await service.consume(baseOptions);
    expect(prisma.rateLimitCounter.deleteMany).toHaveBeenCalledTimes(1);

    now += 61_000;
    await service.consume(baseOptions);
    expect(prisma.rateLimitCounter.deleteMany).toHaveBeenCalledTimes(2);
    const lastCall = prisma.rateLimitCounter.deleteMany.mock.calls.at(-1) as [
      { where: { expiresAt: { lt: Date } } },
    ];
    expect(lastCall[0].where.expiresAt.lt).toBeInstanceOf(Date);
  });

  it('não propaga falha da limpeza oportunista', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ]);
    prisma.rateLimitCounter.deleteMany.mockRejectedValue(
      new Error('cleanup failed'),
    );
    const service = createService(prisma);

    await expect(service.consume(baseOptions)).resolves.toEqual({
      allowed: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
  });
});
