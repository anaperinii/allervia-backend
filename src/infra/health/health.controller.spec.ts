import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';

describe('HealthController', () => {
  const query = jest.fn();
  const controller = new HealthController({
    $queryRaw: query,
  } as unknown as PrismaService);
  it('keeps liveness independent of the database', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });
  it('checks database readiness', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
  });
  it('does not disclose database diagnostics', async () => {
    query.mockRejectedValueOnce(new Error('private database credentials'));
    await expect(controller.ready()).rejects.toMatchObject({
      message: 'Service unavailable',
      status: 503,
    });
  });
});
