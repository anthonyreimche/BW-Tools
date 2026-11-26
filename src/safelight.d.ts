// The slice of Safelight's extension API this extension touches, mirrored from
// the app's src/extensions/types.ts, src/extensions/ui-kit.tsx and the
// develop, catalogue and UI stores. Extensions are standalone bundles, so the
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

/** A point on the develop canvas, in its pixels, from its top-left corner. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** The canvas's pick-drag tool: a press on the image, then with `onDown` the
 *  colour the view shows there once the probe answers, then the drag. */
export interface PickDragTool {
  onPress?(point: CanvasPoint): void;
  onDown?(rgb: readonly [number, number, number], point: CanvasPoint): void;
  onMove?(point: CanvasPoint): void;
  onUp?(): void;
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
  /** The modules the panel may be docked in; omitted, every module (Safelight 3.2.8). */
  modules?: readonly string[];
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

/** Display-encoded sRGB, 0 to 1. */
export type Rgb = readonly [number, number, number];

export interface Hsl {
    /** Degrees, 0 to 360. */
    hue: number;
    /** Percent, 0 to 100. */
    saturation: number;
    /** Percent, 0 to 100. */
    lightness: number;
}

/** The channels a field has: always hue, saturation and lightness when given. */
export interface ColourValue {
    hue: number;
    saturation?: number;
    lightness?: number;
}

export interface ColourFieldProps {
    label: string;
    /** Degrees, 0 to 360. */
    hue: number;
    /** Percent, 0 to 100. Leave it out for a hue-only field. */
    saturation?: number;
    /** Percent, 0 to 100. Give it for a field that also sets lightness. */
    lightness?: number;
    /** Live while a drag lasts, and once for a key, hex or pick; carries the
     *  field's channels only. */
    onChange(value: ColourValue): void;
    /** A drag ended, or a key, hex or pick changed the colour. */
    onCommit?(): void;
    /** The colour to show for hue, saturation and lightness (a missing channel
     *  comes as 100 and 50), display sRGB 0 to 1. Default: HSL. */
    toRgb?(hue: number, saturation: number, lightness: number): Rgb;
    /** A typed or picked colour (display sRGB 0 to 1) in the field's channels.
     *  Default: HSL. */
    fromRgb?(rgb: Rgb): Hsl;
    /** The eyedropper. `true` (the default) takes the colour the view shows;
     *  `{ paramBag }` samples a capture with that bag merged over the photo's,
     *  to leave the extension's own effect out; `false` hides it. */
    pick?: boolean | {
        paramBag: Record<string, unknown>;
    };
    /** The swatch's tooltip. */
    title?: string;
}

export interface UiKit {
  Button: ComponentType<ButtonProps>;
  Select: ComponentType<SelectProps>;
  SegmentedControl: ComponentType<SegmentedControlProps>;
  Section: ComponentType<SectionProps>;
  Row: ComponentType<RowProps>;
  Stack: ComponentType<StackProps>;
  /** A colour control: a swatch as wide as the row that opens a picker under
   *  it (a hue-by-saturation area, or a hue bar for a field without
   *  saturation; a lightness bar for a field with lightness; a hex field),
   *  and an eyedropper that takes the colour of the photo where it is
   *  clicked. `toRgb` and `fromRgb` carry your own colour model (default HSL);
   *  `pick: { paramBag }` samples a capture with that bag, to leave your own
   *  effect out of the sample. Needs Safelight 3.2.8. */
  ColourField(props: ColourFieldProps): import("react").JSX.Element;
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
  navigation: {
    /** The module this window shows: a popped-out window's own module, else
     *  the main window's tab. Ask it before acting on a Develop shortcut,
     *  `current() === "develop"`, rather than reading the URL. Needs
     *  Safelight 3.2.7. */
    current(): string;
  };
  stores: {
    create<T>(init: StateCreator<T>): StoreApi<T>;
    useDevelopStore: StoreApi<DevelopStoreState>;
    useCatalogStore: StoreApi<CatalogStoreState>;
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
    /** A frame of the live view rendered with `params` and `paramBag` merged
     *  over the photo's, aligned 1:1 with the canvas; sRGB. */
    captureFrame(params: DevelopParams, options?: { paramBag?: Record<string, unknown> }): Promise<ImageBitmap>;
    /** Hold the canvas's pick-drag tool, or with null let go of it. Core lets
     *  go on Escape, and when another extension takes it. */
    setPickDrag(tool: PickDragTool | null): void;
    /** React hook: whether this extension holds the pick-drag tool. */
    usePickDragHeld(): boolean;
    /** The mask's scope inside a mask's Adjust tab, the photo's anywhere else. */
    useParamScope(): ParamScope;
  };
}

export interface ExtensionModule {
  activate(api: SafelightAPI): void;
  deactivate?(): void;
}
