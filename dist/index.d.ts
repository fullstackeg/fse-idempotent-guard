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
export declare function createMemoryStore(): IdempotencyStore;
export declare function createIdempotencyGuard(options?: GuardOptions): {
    execute: <T>(key: string, handler: () => Promise<T> | T) => Promise<GuardResult<T>>;
};
//# sourceMappingURL=index.d.ts.map