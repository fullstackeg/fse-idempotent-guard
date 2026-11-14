# fse-idempotent-guard

Zero-dependency idempotency key lock and response deduplicator for Node.js, Edge runtimes, and serverless APIs.

- **Concurrent request coalescing:** Simultaneous calls with the same key await a single in-flight execution instead of running twice.
- **Completed response replay:** Subsequent retries return the cached result immediately with `replayed: true`.
- **Automatic failure release:** If your handler throws, the lock releases immediately so clients can safely retry.
- **Pluggable storage:** Ships with an in-memory TTL store and a simple interface for Redis, Upstash, or KV stores.

## Installation

```bash
npm install fse-idempotent-guard
```

## Quick Start

```ts
import { createIdempotencyGuard } from 'fse-idempotent-guard';

const guard = createIdempotencyGuard({
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours (default)
});

export async function createOrder(idempotencyKey: string, payload: unknown) {
  const { data, replayed } = await guard.execute(idempotencyKey, async () => {
    // Runs only once per key
    return await db.orders.create(payload);
  });

  return { order: data, replayed };
}
```

## Custom Storage Adapter (Redis / KV)

Implement `IdempotencyStore` to persist idempotency keys across multiple server instances:

```ts
import { createIdempotencyGuard, type IdempotencyStore } from 'fse-idempotent-guard';

const redisStore: IdempotencyStore = {
  async get(key) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, record) {
    const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    await redis.set(key, JSON.stringify(record), 'EX', ttlSeconds);
  },
  async delete(key) {
    await redis.del(key);
  },
};

const guard = createIdempotencyGuard({ store: redisStore });
```

## API

### `createIdempotencyGuard(options?)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttlMs` | `number` | `86400000` (24h) | How long completed results stay cached. |
| `store` | `IdempotencyStore` | `createMemoryStore()` | Storage backend for completed records. |
| `prefix` | `string` | `'idem:'` | Key namespace prefix passed to the store. |

### `guard.execute(key, handler)`

Returns `Promise<{ data: T; replayed: boolean }>`.

## License

MIT