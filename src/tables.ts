// The conversion's data: film responses, colour filters, the eight mix bands
// and the toner recipes. Written once here; model.ts reads them and glsl.ts
// formats them into the stage source, so the TS twin and the shader can't
// drift. The response and filter values are approximations over the linear
// Rec.709 primaries (no spectral data), a starting point tuned in the app.

export type Vec3 = readonly [number, number, number];

export interface ResponseDef {
  label: string;
  /** Linear Rec.709 weights before normalisation; null = the Custom sliders. */
  weights: Vec3 | null;
}

export const NEUTRAL_WEIGHTS: Vec3 = [0.2126, 0.7152, 0.0722];

export const RESPONSES: readonly ResponseDef[] = [
  { label: "Neutral", weights: NEUTRAL_WEIGHTS },
  { label: "Panchromatic", weights: [0.27, 0.53, 0.2] },
  { label: "Extended red", weights: [0.45, 0.4, 0.15] },
  { label: "Orthochromatic", weights: [0, 0.55, 0.45] },
  { label: "Blue-sensitive", weights: [0, 0.1, 0.9] },
  { label: "Infrared", weights: [0.55, 0.95, -0.5] },
  { label: "Custom", weights: null },
];

export const CUSTOM_RESPONSE = 6;

export interface FilterDef {
  label: string;
  /** Transmission at full strength, linear Rec.709. */
  transmission: Vec3;
}

export const FILTERS: readonly FilterDef[] = [
  { label: "None", transmission: [1, 1, 1] },
  { label: "Yellow (#8)", transmission: [1, 0.95, 0.35] },
  { label: "Deep yellow (#15)", transmission: [1, 0.85, 0.15] },
  { label: "Orange (#21)", transmission: [1, 0.6, 0.05] },
  { label: "Red (#25)", transmission: [1, 0.15, 0.02] },
  { label: "Deep red (#29)", transmission: [1, 0.05, 0.01] },
  { label: "Yellow-green (#11)", transmission: [0.55, 1, 0.35] },
  { label: "Green (#58)", transmission: [0.15, 1, 0.15] },
  { label: "Blue (#47)", transmission: [0.05, 0.2, 1] },
];

export const BAND_LABELS = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"] as const;

// Core HSL's HSL_CENTERS / HSL_DPREV / HSL_DNEXT (shaders.ts), so the eight
// colours mean what they mean in the HSL panel.
export const BAND_CENTRES = [0, 30, 60, 120, 180, 240, 280, 320] as const;
export const BAND_DPREV = [40, 30, 30, 60, 60, 60, 40, 40] as const;
export const BAND_DNEXT = [30, 30, 60, 60, 60, 40, 40, 40] as const;

/** One recipe node: a hue in degrees and a strength 0…1. */
export type TonerNode = readonly [hue: number, strength: number];

export interface TonerDef {
  label: string;
  /** At display luma 0, 1/3, 2/3 and 1. */
  nodes: readonly [TonerNode, TonerNode, TonerNode, TonerNode];
}

export const TONERS: readonly TonerDef[] = [
  { label: "None", nodes: [[0, 0], [0, 0], [0, 0], [0, 0]] },
  { label: "Sepia", nodes: [[30, 0.1], [32, 0.45], [35, 0.6], [38, 0.4]] },
  { label: "Selenium", nodes: [[330, 0.35], [345, 0.25], [20, 0.08], [0, 0]] },
  { label: "Gold", nodes: [[220, 0.25], [215, 0.25], [210, 0.15], [200, 0.05]] },
  { label: "Cyanotype", nodes: [[205, 0.55], [205, 0.75], [200, 0.6], [195, 0.3]] },
  { label: "Platinum", nodes: [[28, 0.2], [30, 0.25], [35, 0.22], [40, 0.12]] },
  { label: "Copper", nodes: [[12, 0.35], [15, 0.5], [18, 0.45], [20, 0.2]] },
  { label: "Split (selenium + sepia)", nodes: [[260, 0.3], [240, 0.15], [35, 0.25], [38, 0.35]] },
];

/** Stops a fully saturated colour at a band centre moves at ±100. */
export const MIX_EV = 2;
/** The largest tint a toner node or split-tone slider adds, in display units. */
export const TINT_MAX = 0.25;
/** How far a fully saturated paper tint pulls its weakest channel down at white. */
export const PAPER_MAX = 0.15;
/** Floor for the weight sum, so a near-zero combination never flips sign. */
export const WEIGHT_SUM_FLOOR = 0.05;

/** A GLSL float literal. GLSL ES has no int→float conversion: a bare `1`
 *  where a float is expected is a compile error that kills the program. */
export function glslFloat(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`[black-and-white] not a finite number: ${v}`);
  const s = String(v === 0 ? 0 : v);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

export function glslVec3(v: Vec3): string {
  return `vec3(${v.map(glslFloat).join(", ")})`;
}
