/** A small in-memory cache whose entries expire after a per-entry TTL. */
export type TtlCache<T> = {
  get: (key: string) => T | undefined;
  set: (key: string, value: T, ttlMs?: number) => void;
  delete: (key: string) => void;
};

export const createTtlCache = <T,>(defaultTtlMs: number): TtlCache<T> => {
  const entries = new Map<string, { at: number; ttl: number; value: T }>();
  return {
    get: (key) => {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.at >= entry.ttl) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set: (key, value, ttlMs = defaultTtlMs) => {
      entries.set(key, { at: Date.now(), ttl: ttlMs, value });
    },
    delete: (key) => {
      entries.delete(key);
    },
  };
};
