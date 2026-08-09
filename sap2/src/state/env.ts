// Environment seam (blueprint §4.5): the ONLY place the app touches the clock and
// storage. Deterministic modules (engine/schema/render/scene) are lint-banned from
// clocks entirely (G-9); the shell records provenance timestamps through this
// injectable seam so tests control time and storage-disabled environments degrade
// to in-memory with a visible notice instead of crashing.

export interface Env {
  /** ISO date-time string for provenance records (conditions acceptance, session). */
  nowISO(): string;
  read(key: string): string | null;
  write(key: string, value: string): void;
  /** True when writes actually persist (false ⇒ in-memory degradation notice). */
  readonly persistent: boolean;
}

export const browserEnv = (): Env => {
  let storageOk = true;
  const mem = new Map<string, string>();
  try {
    const probe = '__sap2_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch {
    storageOk = false;
  }
  return {
    nowISO: () => new Date().toISOString(),
    read: (k) => (storageOk ? localStorage.getItem(k) : (mem.get(k) ?? null)),
    write: (k, v) => {
      if (storageOk) localStorage.setItem(k, v);
      else mem.set(k, v);
    },
    persistent: storageOk,
  };
};

export const memoryEnv = (fixedISO: string): Env => {
  const mem = new Map<string, string>();
  return {
    nowISO: () => fixedISO,
    read: (k) => mem.get(k) ?? null,
    write: (k, v) => { mem.set(k, v); },
    persistent: false,
  };
};
