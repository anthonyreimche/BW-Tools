// Stand-ins for the host's zustand stores and the develop store's actions.
// No React: components are exercised in the app.

import type { DevelopParams, DevelopStoreState, StateCreator, StoreApi } from "../../src/safelight";

export function fakeStore<T extends object>(init: StateCreator<T> | T): StoreApi<T> {
  let state: T;
  const listeners = new Set<(s: T, prev: T) => void>();
  const set = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
    const prev = state;
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
    for (const l of listeners) l(state, prev);
  };
  const get = () => state;
  state = typeof init === "function" ? (init as StateCreator<T>)(set, get) : init;
  const hook = ((selector?: (s: T) => unknown) => (selector ? selector(state) : state)) as StoreApi<T>;
  hook.getState = get;
  hook.setState = set;
  hook.subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return hook;
}

export interface FakeDevelop {
  store: StoreApi<DevelopStoreState>;
  /** commitEdit labels, in order, with the photo they committed. */
  commits: { photoId: string | null; label: string }[];
  /** loadEdit calls: [photoId, asShotTemperature]. */
  loads: [string, number | undefined][];
  /** Saved bags per photo; loadEdit reads them, commitEdit writes them. */
  saved: Map<string, Record<string, unknown>>;
}

/** A develop store whose loadEdit/commitEdit move bags in and out of `saved`;
 *  loading an id in `failing` rejects. */
export function fakeDevelop(saved = new Map<string, Record<string, unknown>>(), failing = new Set<string>()): FakeDevelop {
  const commits: FakeDevelop["commits"] = [];
  const loads: FakeDevelop["loads"] = [];
  const store = fakeStore<DevelopStoreState>({
    photoId: null,
    params: {} as DevelopParams,
    previewParams: null,
    paramBag: {},
    histogram: null,
    setDynParams: (patch) => store.setState((s) => ({ paramBag: { ...s.paramBag, ...patch } })),
    commitEdit: async (label) => {
      const s = store.getState();
      commits.push({ photoId: s.photoId, label });
      if (s.photoId) saved.set(s.photoId, s.paramBag);
    },
    loadEdit: async (photoId, asShot) => {
      loads.push([photoId, asShot]);
      if (failing.has(photoId)) throw new Error(`cannot load ${photoId}`);
      store.setState({ photoId, paramBag: { ...(saved.get(photoId) ?? {}) } });
    },
  });
  return { store, commits, loads, saved };
}
