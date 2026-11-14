"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createIdempotencyGuard: () => createIdempotencyGuard,
  createMemoryStore: () => createMemoryStore
});
module.exports = __toCommonJS(index_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createIdempotencyGuard,
  createMemoryStore
});
//# sourceMappingURL=index.cjs.map