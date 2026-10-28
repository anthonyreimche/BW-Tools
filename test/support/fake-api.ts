// Stand-ins for the host's zustand stores and the develop store's actions.
// No React: a panel renders through a createElement that records the tree, so
// a test finds a control by its props and calls its handlers.

import type {
  DevelopParams,
  DevelopStoreState,
  ParamScope,
  SafelightAPI,
  StateCreator,
  StoreApi,
} from "../../src/safelight";

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

/** What the recording createElement hands back. */
export interface FakeElement {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

function isElement(v: unknown): v is FakeElement {
  return typeof v === "object" && v !== null && "type" in v && "props" in v && "children" in v;
}

/** Every element in a rendered tree, those held in props (a Section's `right`) included. */
export function elements(node: unknown): FakeElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isElement(node)) return [];
  return [node, ...Object.values(node.props).flatMap(elements), ...node.children.flatMap(elements)];
}

export type MaskStore = StoreApi<{ bag: Record<string, unknown> }>;

export interface PanelRig {
  api: SafelightAPI;
  develop: FakeDevelop;
  /** Labels committed through a mask's scope, in order. */
  maskCommits: string[];
  /** The photo ids renderPhotoFrame was asked for; it never settles. */
  renders: string[];
  /** Puts what renders from here on inside a mask holding `bag`, as the core's
   *  Masking panel does; returns the mask's store. */
  inMask(bag?: Record<string, unknown>): MaskStore;
}

/** The host a panel renders against, with photo "p" open holding `bag`. The ui
 *  kit's components are their names, so a test finds one by type. */
export function fakePanelApi(bag: Record<string, unknown> = {}): PanelRig {
  const develop = fakeDevelop(new Map([["p", bag]]));
  develop.store.setState({ photoId: "p", paramBag: { ...bag } });
  const maskCommits: string[] = [];
  const renders: string[] = [];
  let mask: MaskStore | null = null;
  const photoScope: ParamScope = {
    maskId: null,
    getParam: (key) => develop.store.getState().paramBag[key],
    getParams: () => develop.store.getState().paramBag,
    setParams: (patch) => develop.store.getState().setDynParams(patch),
    commit: (label) => void develop.store.getState().commitEdit(label),
  };
  const maskScope = (m: MaskStore): ParamScope => ({
    maskId: "mask-1",
    getParam: (key) => m.getState().bag[key],
    getParams: () => m.getState().bag,
    setParams: (patch) => m.setState((s) => ({ bag: { ...s.bag, ...patch } })),
    commit: (label) => void maskCommits.push(label),
  });
  const api = {
    version: 1,
    extensionId: "black-and-white",
    react: {
      createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): FakeElement => ({
        type,
        props: props ?? {},
        children,
      }),
    },
    components: { Slider: "Slider" },
    ui: {
      Button: "Button",
      Select: "Select",
      SegmentedControl: "SegmentedControl",
      Section: "Section",
      Row: "Row",
      Stack: "Stack",
      tokens: {},
    },
    stores: { create: fakeStore, useDevelopStore: develop.store },
    keybindings: { getBinding: () => "V" },
    develop: {
      renderPhotoFrame: (photoId: string) => {
        renders.push(photoId);
        return new Promise<ImageBitmap | null>(() => undefined);
      },
      useParamScope: () => (mask ? maskScope(mask) : photoScope),
    },
  } as unknown as SafelightAPI;
  const inMask = (maskBag: Record<string, unknown> = {}) => {
    mask = fakeStore<{ bag: Record<string, unknown> }>({ bag: { ...maskBag } });
    return mask;
  };
  return { api, develop, maskCommits, renders, inMask };
}
