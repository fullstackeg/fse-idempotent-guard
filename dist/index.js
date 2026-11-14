// src/index.ts
function createMemoryStore() {
  const map = /* @__PURE__ */ new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        map.delete(key);
        return null;
      }
      return entry;
    },
    set(key, record) {
      map.set(key, record);
    },
    delete(key) {
      map.delete(key);
    }
  };
}
function createIdempotencyGuard(options = {}) {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1e3;
  const store = options.store ?? createMemoryStore();
  const prefix = options.prefix ?? "idem:";
  const inFlight = /* @__PURE__ */ new Map();
  async function execute(key, handler) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      throw new Error("Idempotency key must be a non-empty string.");
    }
    const storageKey = `${prefix}${trimmedKey}`;
    const cached = await store.get(storageKey);
    if (cached && Date.now() <= cached.expiresAt) {
      return { data: cached.value, replayed: true };
    }
    const existingFlight = inFlight.get(storageKey);
    if (existingFlight) {
      const data2 = await existingFlight;
      return { data: data2, replayed: true };
    }
    const executionPromise = (async () => {
      try {
        const result = await handler();
        await store.set(storageKey, {
          value: result,
          expiresAt: Date.now() + ttlMs
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
export {
  createIdempotencyGuard,
  createMemoryStore
};
//# sourceMappingURL=index.js.map