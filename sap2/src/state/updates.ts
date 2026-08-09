// Update controller (the owner's chosen workflow): the app notices when a new
// version has been deployed and offers an UPDATE button — it never swaps itself out
// from under you mid-session.
//
// How the detection works, honestly: the browser re-checks the app's own sw.js on
// load (and whenever we call update()). If the deployment changed, sw.js differs,
// the new worker installs and parks in `waiting`, and we surface the button. No
// polling of anything external, no telemetry, no version server — the only request
// is for this app's own file from wherever you loaded it.

export type UpdateState =
  | { readonly kind: 'unsupported' }   // file:// standalone, or no SW support
  | { readonly kind: 'current' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready' }         // a new version is installed and waiting
  | { readonly kind: 'installing' };

export interface UpdateController {
  /** Apply the waiting update and reload. */
  apply(): void;
  /** Ask the browser to re-check now. */
  check(): Promise<void>;
  readonly state: () => UpdateState;
}

export interface UpdateHooks {
  onState(state: UpdateState): void;
  onVersion(version: string): void;
}

const NOOP_CONTROLLER: UpdateController = {
  apply: () => {},
  check: async () => {},
  state: () => ({ kind: 'unsupported' }),
};

export const startUpdates = (hooks: UpdateHooks): UpdateController => {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  // Service workers do not run from file:// — the single-file artifact is updated by
  // downloading a new copy, which is the correct model for an air-gapped machine.
  if (!nav?.serviceWorker || location.protocol === 'file:') {
    hooks.onState({ kind: 'unsupported' });
    return NOOP_CONTROLLER;
  }

  let state: UpdateState = { kind: 'current' };
  const set = (s: UpdateState): void => {
    state = s;
    hooks.onState(s);
  };

  let registration: ServiceWorkerRegistration | null = null;
  let reloading = false;

  nav.serviceWorker.addEventListener('controllerchange', () => {
    // Fires once the new worker takes over after SKIP_WAITING.
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  const watch = (reg: ServiceWorkerRegistration): void => {
    if (reg.waiting) set({ kind: 'ready' });
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      set({ kind: 'installing' });
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // A waiting worker with an existing controller means a genuine UPDATE
          // (not the very first install of the app).
          set(nav.serviceWorker.controller ? { kind: 'ready' } : { kind: 'current' });
        }
      });
    });
  };

  void nav.serviceWorker.register('./sw.js').then((reg) => {
    registration = reg;
    watch(reg);
    askVersion(nav, hooks);
  }).catch(() => {
    set({ kind: 'unsupported' });
  });

  return {
    apply: () => {
      const waiting = registration?.waiting;
      if (!waiting) return;
      waiting.postMessage({ type: 'SKIP_WAITING' });
    },
    check: async () => {
      if (!registration) return;
      set({ kind: 'checking' });
      try {
        await registration.update();
        if (!registration.waiting) set({ kind: 'current' });
      } catch {
        set({ kind: 'current' });
      }
    },
    state: () => state,
  };
};

const askVersion = (nav: Navigator, hooks: UpdateHooks): void => {
  const active = nav.serviceWorker.controller;
  if (!active || typeof MessageChannel === 'undefined') return;
  const channel = new MessageChannel();
  channel.port1.onmessage = (event: MessageEvent) => {
    const v = (event.data as { version?: unknown } | null)?.version;
    if (typeof v === 'string') hooks.onVersion(v);
  };
  active.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
};
