// Pluggable persistence (§13, §15). A tiny async key/value adapter interface so scenarios can
// be stored in IndexedDB in the browser and in memory under test. No third-party dependency.

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

// In-memory adapter — used by tests and as a pre-persistence fallback.
export class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}

const DB_NAME = 'sap1';
const STORE = 'kv';

// IndexedDB adapter (browser only). Falls back to MemoryAdapter where indexedDB is absent.
export function createStorageAdapter(): StorageAdapter {
  const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
  if (!idb) return new MemoryAdapter();

  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    async get(key) {
      const v = await tx<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>);
      return v ?? null;
    },
    async set(key, value) {
      await tx('readwrite', (s) => s.put(value, key));
    },
    async remove(key) {
      await tx('readwrite', (s) => s.delete(key));
    },
    async keys() {
      const ks = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
      return ks.map(String);
    },
  };
}
