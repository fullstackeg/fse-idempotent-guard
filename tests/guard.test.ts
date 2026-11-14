import { describe, it, expect, vi } from 'vitest';
import { createIdempotencyGuard } from '../src/index';

describe('createIdempotencyGuard', () => {
  it('executes once and replays cached result on subsequent calls', async () => {
    const guard = createIdempotencyGuard({ ttlMs: 10_000 });
    const handler = vi.fn(async () => ({ orderId: 'ORD-101' }));

    const first = await guard.execute('key-1', handler);
    const second = await guard.execute('key-1', handler);

    expect(first).toEqual({ data: { orderId: 'ORD-101' }, replayed: false });
    expect(second).toEqual({ data: { orderId: 'ORD-101' }, replayed: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous in-flight requests with the same key', async () => {
    const guard = createIdempotencyGuard();
    let count = 0;

    const slowTask = () =>
      new Promise<number>((resolve) => {
        count += 1;
        setTimeout(() => resolve(42), 30);
      });

    const [resA, resB] = await Promise.all([
      guard.execute('race-key', slowTask),
      guard.execute('race-key', slowTask),
    ]);

    expect(count).toBe(1);
    expect(resA.data).toBe(42);
    expect(resB.data).toBe(42);
    expect(resB.replayed).toBe(true);
  });

  it('releases the lock when the handler throws so retries can succeed', async () => {
    const guard = createIdempotencyGuard();
    let attempt = 0;

    await expect(
      guard.execute('flaky-key', async () => {
        attempt += 1;
        throw new Error('Temporary DB timeout');
      })
    ).rejects.toThrow('Temporary DB timeout');

    const retry = await guard.execute('flaky-key', async () => {
      attempt += 1;
      return 'recovered';
    });

    expect(attempt).toBe(2);
    expect(retry).toEqual({ data: 'recovered', replayed: false });
  });
});