import { NotificationsDispatcher } from './notifications.dispatcher';
import { NotificationsService } from './notifications.service';
import { RetentionService } from 'src/infra/retention/retention.service';

describe('NotificationsDispatcher shutdown', () => {
  it('waits for acquired work and does not acquire again after shutdown', async () => {
    jest.useFakeTimers();
    const previous = process.env.NODE_ENV;
    const disabled = process.env.ALLERVIA_DISPATCHERS_DISABLED;
    process.env.NODE_ENV = 'development';
    delete process.env.ALLERVIA_DISPATCHERS_DISABLED;
    let complete!: (result: { failed: number }) => void;
    const work = new Promise<{ failed: number }>((resolve) => {
      complete = resolve;
    });
    const processPending = jest.fn().mockReturnValue(work);
    const dispatcher = new NotificationsDispatcher(
      { processPending } as unknown as NotificationsService,
      { runOnce: jest.fn() } as unknown as RetentionService,
    );
    try {
      dispatcher.onModuleInit();
      jest.advanceTimersByTime(15_000);
      expect(processPending).toHaveBeenCalledTimes(1);
      let stopped = false;
      const stopping = dispatcher.onModuleDestroy().then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);
      complete({ failed: 0 });
      await stopping;
      jest.advanceTimersByTime(30_000);
      expect(processPending).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      if (disabled === undefined)
        delete process.env.ALLERVIA_DISPATCHERS_DISABLED;
      else process.env.ALLERVIA_DISPATCHERS_DISABLED = disabled;
      jest.useRealTimers();
    }
  });
});
