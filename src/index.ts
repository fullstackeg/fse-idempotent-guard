export interface StoredRecord<T> {
  value: T;
  expiresAt: number;
}

export interface IdempotencyStore {
  get<T>(key: string): Promise<StoredRecord<T> | null> | StoredRecord<T> | null;
  set<T>(key: string, record: StoredRecord<T>): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

export interface GuardOptions {
  /** Cache duration in milliseconds (default: 24 hours) */
  ttlMs?: number;
  /** Custom storage adapter (defaults to built-in in-memory store) */
  store?: IdempotencyStore;
  /** Optional prefix for storage keys (default: "idem:") */
  prefix?: string;
}

export interface GuardResult<T> {
  data: T;
  replayed: boolean;
}

export function createMemoryStore(): IdempotencyStore {
  const map = new Map<string, StoredRecord<unknown>>();

  return {
    get<T>(key: string): StoredRecord<T> | null {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return null;
      }
      return entry as StoredRecord<T>;
    },
    set<T>(key: string, record: StoredRecord<T>): void {
      map.set(key, record);
    },
    delete(key: string): void {
      map.delete(key);
    },
  };
}

export function createIdempotencyGuard(options: GuardOptions = {}) {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const store = options.store ?? createMemoryStore();
  const prefix = options.prefix ?? 'idem:';
  const inFlight = new Map<string, Promise<unknown>>();

  async function execute<T>(
    key: string,
    handler: () => Promise<T> | T
  ): Promise<GuardResult<T>> {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      throw new Error('Idempotency key must be a non-empty string.');
    }

    const storageKey = `${prefix}${trimmedKey}`;

    // 1. Check completed cache
    const cached = await store.get<T>(storageKey);
    if (cached && Date.now() <= cached.expiresAt) {
      return { data: cached.value, replayed: true };
    }

    // 2. Coalesce concurrent identical requests currently running
    const existingFlight = inFlight.get(storageKey) as Promise<T> | undefined;
    if (existingFlight) {
      const data = await existingFlight;
      return { data, replayed: true };
    }

    // 3. Execute handler once and lock in-flight map
    const executionPromise = (async () => {
      try {
        const result = await handler();
        await store.set(storageKey, {
          value: result,
          expiresAt: Date.now() + ttlMs,
        });
        return result;
      } finally {
        inFlight.delete(storageKey);
      }
    })();

    inFlight.set(storageKey, executionPromise);

    const data = await executionPromise;
    return { data, replayed: false };
  }

  return { execute };
}