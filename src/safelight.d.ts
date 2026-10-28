// The slice of Safelight's extension API this extension touches, mirrored from
// the app's src/extensions/types.ts, src/extensions/ui-kit.tsx and the
// develop, catalog and UI stores. Extensions are standalone bundles, so the
// host's source is not on the type path; React types come from @types/react
// (dev only).

import type { ComponentType, CSSProperties, ReactNode } from "react";

export interface StoreApi<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState(): T;
  setState(partial: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((s: T) => Partial<T>)) => void,
  get: () => T,
) => T;

/** Core develop params: opaque here, only ever handed back to core. */
export type DevelopParams = Record<string, unknown> & { readonly __develop: unique symbol };

export interface DevelopStoreState {
  photoId: string | null;
  params: DevelopParams;
  previewParams: DevelopParams | null;
  /** Extension stage params by qualified key. Values come back from sidecar
   *  JSON, so they are read defensively (params.ts). */
  paramBag: Record<string, unknown>;
  /** Recomputed by core after every settled render. */
  histogram: object | null;
  setDynParams(patch: Record<string, unknown>): void;
  commitEdit(label: string): Promise<void>;
  /** Pass the photo's as-shot temperature, or edited thumbnails go warm. */
  loadEdit(photoId: string, asShotTemperature?: number): Promise<void>;
}

export interface CatalogPhotoLike {
  id: string;
  exif: { colorTemperature?: number };
}

export interface CatalogStoreState {
  photos: CatalogPhotoLike[];
  activePhotoId: string | null;
}

export interface UIStoreState {
  activeModule: string;
}

export interface OverlayRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DevelopOverlayState {
  /** Where the displayed pixels sit; the visible window when zoomed. */
  rect: OverlayRect | null;
  /** Where the full image sits; extends past the frame when zoomed. Null until
   *  the first layout. */
  imageRect: OverlayRect | null;
  nonce: number;
}

export type GlslType = "float" | "int" | "bool" | "vec2" | "vec3" | "vec4" | "sampler2D";

export interface UniformDeclaration {
  key: string;
  glslType: GlslType;
  default: number | number[] | boolean;
  range?: { min: number; max: number; step?: number };
  label?: string;
}

export type ProcessingPhase =
  | "geometry"
  | "decode"
  | "noise-reduction"
  | "scene-linear"
  | "tone-map"
  | "display-adjust"
  | "effects"
  | "output-encode";

/** The values a processing stage receives and hands back. */
export interface StageSpace {
  /** "linear": proportional to light. "perceptual": the sRGB curve extended both
   *  ways (sign kept, no ceiling), so display-style maths still sees what lies
   *  beyond [0, 1]. */
  encoding: "linear" | "perceptual";
  /** Default "rec709", the core's working primaries. */
  primaries?: "rec709" | "rec2020";
}

export interface ProcessingStageContribution {
  id: string;
  name: string;
  phase: ProcessingPhase;
  priority?: number;
  glsl: string;
  helpers?: string;
  uniforms: UniformDeclaration[];
  presetScope?: "global" | "per-image";
  /** Opt into full-information values. Omitted, a display-domain stage is handed
   *  `c` clipped to [0, 1] on process version 2, the clip written ahead of its
   *  block and outside its own gate. Hosts before process versions ignore it. */
  space?: StageSpace;
  /** Runs the stage again inside each mask whose bag holds its keys, with that
   *  mask's values, blended by its coverage (Safelight 3.1.0, process version 2
   *  photos). */
  mask?: { maskable: true };
}

export interface PanelContribution {
  id: string;
  title: string;
  component: ComponentType;
  defaultDock?: {
    module: "library" | "develop";
    direction: "left" | "right" | "bottom";
    order?: number;
    width?: number;
    height?: number;
  };
  onReset?: () => void;
  /** Offers the panel in a mask's Adjust tab: each mask that adds it renders
   *  `component`, which edits that mask's values through useParamScope. `owns`
   *  lists every qualified key it writes, seeded on add and cleared on remove. */
  mask?: { component: ComponentType; order?: number; owns: readonly string[] };
}

/** The params a panel edits: the photo's bag, or one mask's (maskId set).
 *  Reads see the store as it is now, not as the render was handed it. */
export interface ParamScope {
  maskId: string | null;
  getParam(key: string): unknown;
  /** The stored values by qualified key, without defaults. */
  getParams(): Readonly<Record<string, unknown>>;
  setParams(patch: Record<string, unknown>): void;
  commit(label: string): void;
}

export interface SlotContribution {
  id: string;
  slot: "develop-canvas-overlay" | "develop-toolbar" | "library-toolbar" | "library-subbar";
  component: ComponentType;
  order?: number;
}

export interface KeyActionContribution {
  id: string;
  label: string;
  category?: "General" | "Develop" | "Library";
  defaultCombo: string;
  handler(): void;
}

export interface GridMenuItemContribution {
  id: string;
  label: string | ((ids: string[]) => string);
  order?: number;
  enabled?: (ids: string[]) => boolean;
  onClick: (ids: string[]) => void;
}

export interface SliderProps {
  label: string;
  value: number;
  onChange(value: number): void;
  onCommit?(): void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  hideValue?: boolean;
  compact?: boolean;
  trackBackground?: string;
}

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  active?: boolean;
  full?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?(): void;
  children?: ReactNode;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange(value: string): void;
  options?: SelectOption[];
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
}

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  title?: string;
}

export interface SegmentedControlProps {
  value: string;
  onChange(value: string): void;
  options: SegmentedOption[];
  size?: "sm" | "md";
}

export interface SectionProps {
  title: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}

export interface RowProps {
  children?: ReactNode;
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  style?: CSSProperties;
}

export interface StackProps {
  children?: ReactNode;
  gap?: number;
  style?: CSSProperties;
}

export interface UiKit {
  Button: ComponentType<ButtonProps>;
  Select: ComponentType<SelectProps>;
  SegmentedControl: ComponentType<SegmentedControlProps>;
  Section: ComponentType<SectionProps>;
  Row: ComponentType<RowProps>;
  Stack: ComponentType<StackProps>;
  tokens: Readonly<Record<string, string>>;
}

export interface SafelightAPI {
  version: 1;
  extensionId: string;
  react: typeof import("react");
  registerProcessingStage(c: ProcessingStageContribution): void;
  unregisterProcessingStage(id: string): void;
  registerPanel(c: PanelContribution): void;
  registerSlot(c: SlotContribution): void;
  unregisterSlot(id: string): void;
  registerKeybinding(c: KeyActionContribution): void;
  registerGridMenuItem(c: GridMenuItemContribution): void;
  settings: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): void;
    onChange(cb: (key: string, value: unknown) => void): () => void;
  };
  components: {
    Slider: ComponentType<SliderProps>;
  };
  ui: UiKit;
  stores: {
    create<T>(init: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
    useCatalogStore: StoreApi<CatalogStoreState>;
    useUIStore: StoreApi<UIStoreState>;
  };
  keybindings: {
    /** The action's current combo; "" when unbound. */
    getBinding(actionId: string): string;
  };
  cursors: {
    resolve(token: string): string;
  };
  develop: {
    useDevelopOverlay(): DevelopOverlayState;
    renderPhotoFrame(
      photoId: string,
      params: DevelopParams,
      paramBag?: Record<string, unknown>,
    ): Promise<ImageBitmap | null>;
    /** The mask's scope inside a mask's Adjust tab, the photo's anywhere else. */
    useParamScope(): ParamScope;
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
