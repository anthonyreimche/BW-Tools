// The TS twin of both stages. Every function here has a GLSL counterpart in
// glsl.ts that uses the same expression order, so the GPU spec can hold the
// shader to this file within half-float error. Hue maths mirrors core HSL
// (hslBandWeight at range 1, smoothness 1) so the eight colours mean what they
// mean in the HSL panel.

import {
  BAND_CENTRES,
  BAND_DNEXT,
  BAND_DPREV,
  FILTERS,
  MIX_EV,
  PAPER_MAX,
  RESPONSES,
  TINT_MAX,
  TONERS,
  WEIGHT_SUM_FLOOR,
} from "./tables";
import { TONING_KEYS } from "./params";

export type RGB = [number, number, number];

export interface ConvertParams {
  response: number;
  filterType: number;
  /** 0…100 % */
  filterStrength: number;
  /** Custom response, −200…200 % */
  mixR: number;
  mixG: number;
  mixB: number;
  /** Eight band sliders, −100…100. */
  bands: readonly number[];
  keepHue: number;
  keepRange: number;
  keepAmount: number;
}

export const luma = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** GLSL smoothstep; e0 < e1 everywhere it is called. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Core linearToSrgb (clamps to [0, 1] first). */
export function encodeSrgb(x: number): number {
  const c = clamp01(x);
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Core srgbToLinear. */
export function decodeSrgb(x: number): number {
  return x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** GLSL mod: x − y·floor(x/y). */
const glslMod = (x: number, y: number): number => x - y * Math.floor(x / y);

/** HSL hue in degrees of an encoded colour, branch order as in the GLSL. */
export function hueOf(e: readonly number[]): number {
  const [r, g, b] = e;
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (d < 1e-6) return 0;
  let h: number;
  if (r >= g && r >= b) h = glslMod((g - b) / d, 6);
  else if (g >= b) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h * 60;
}

export interface HueChroma {
  /** Degrees, [0, 360). */
  hue: number;
  /** HSV saturation of the normalised colour. */
  sat: number;
  /** How much a band slider may act on this colour, 0…1. */
  chroma: number;
}

/** Hue and chroma of a linear colour, taken after scaling its brightest
 *  channel to 1, so exposure doesn't change them. */
export function hueChroma(lin: readonly number[]): HueChroma {
  const m = Math.max(lin[0], lin[1], lin[2]);
  if (m <= 1e-6) return { hue: 0, sat: 0, chroma: 0 };
  const e = [0, 1, 2].map((i) => encodeSrgb(Math.max(lin[i], 0) / m));
  const sat = 1 - Math.min(e[0], e[1], e[2]);
  return { hue: hueOf(e), sat, chroma: smoothstep(0, 0.5, sat) };
}

/** Core hslBandWeight at range 1 and smoothness 1. */
export function bandWeight(hue: number, band: number): number {
  const d = glslMod(hue - BAND_CENTRES[band] + 540, 360) - 180;
  const dPrev = BAND_DPREV[band];
  const dNext = BAND_DNEXT[band];
  let t: number;
  if (d <= 0) {
    if (d <= -dPrev) return 0;
    t = (d + dPrev) / dPrev;
  } else {
    if (d >= dNext) return 0;
    t = 1 - d / dNext;
  }
  return t * t * (3 - 2 * t);
}

/** Selective colour's hue window: 1 at the centre, 0 at ±halfWidth degrees. */
export function hueWindow(hue: number, centre: number, halfWidth: number): number {
  const d = Math.abs(glslMod(hue - centre + 540, 360) - 180);
  if (d >= halfWidth) return 0;
  const t = 1 - d / halfWidth;
  return t * t * (3 - 2 * t);
}

/** Response × filter, normalised so the weights sum to 1 (grey stays grey). */
export function conversionWeights(
  p: Pick<ConvertParams, "response" | "filterType" | "filterStrength" | "mixR" | "mixG" | "mixB">,
): RGB {
  const def = RESPONSES[p.response] ?? RESPONSES[0];
  const base = def.weights ?? [p.mixR / 100, p.mixG / 100, p.mixB / 100];
  const t = (FILTERS[p.filterType] ?? FILTERS[0]).transmission;
  const s = clamp01(p.filterStrength / 100);
  const v: RGB = [
    base[0] * (1 + (t[0] - 1) * s),
    base[1] * (1 + (t[1] - 1) * s),
    base[2] * (1 + (t[2] - 1) * s),
  ];
  const sum = Math.max(v[0] + v[1] + v[2], WEIGHT_SUM_FLOOR);
  return [v[0] / sum, v[1] / sum, v[2] / sum];
}

/** Σ band/100 · weight(hue): the mix's exponent in units of MIX_EV. */
export function mixAmount(hue: number, bands: readonly number[]): number {
  let a = 0;
  for (let i = 0; i < 8; i++) a += (bands[i] / 100) * bandWeight(hue, i);
  return a;
}

/** The convert stage on one scene-linear pixel, treatment on. */
export function convert(lin: readonly number[], p: ConvertParams): RGB {
  const w = conversionWeights(p);
  const { hue, chroma } = hueChroma(lin);
  let y = Math.max(w[0] * lin[0] + w[1] * lin[1] + w[2] * lin[2], 0);
  y *= Math.pow(2, MIX_EV * chroma * mixAmount(hue, p.bands));
  const keep = clamp01(p.keepAmount / 100) * hueWindow(hue, p.keepHue, p.keepRange) * chroma;
  const l = luma(lin);
  const coloured: RGB = l > 1e-6 ? [lin[0] * (y / l), lin[1] * (y / l), lin[2] * (y / l)] : [y, y, y];
  return [
    y * (1 - keep) + coloured[0] * keep,
    y * (1 - keep) + coloured[1] * keep,
    y * (1 - keep) + coloured[2] * keep,
  ];
}

export interface ToneParams {
  toner: number;
  /** 0…100 % */
  tonerStrength: number;
  hiHue: number;
  hiSat: number;
  shHue: number;
  shSat: number;
  /** −100…100: moves the split point between shadows and highlights. */
  balance: number;
  paperHue: number;
  paperSat: number;
}

/** The pure colour at a hue: HSL saturation 1, lightness 0.5. */
export function hueRgb(hue: number): RGB {
  const h = hue / 60;
  return [
    clamp01(Math.abs(glslMod(h, 6) - 3) - 1),
    clamp01(Math.abs(glslMod(h + 4, 6) - 3) - 1),
    clamp01(Math.abs(glslMod(h + 2, 6) - 3) - 1),
  ];
}

/** A zero-luma direction toward a hue, largest component 1: adding any
 *  multiple of it tints without changing luminance. */
export function tintDirection(hue: number): RGB {
  const h = hueRgb(hue);
  const l = luma(h);
  const d: RGB = [h[0] - l, h[1] - l, h[2] - l];
  const m = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  return [d[0] / m, d[1] / m, d[2] / m];
}

const scaled = (d: RGB, k: number): RGB => [d[0] * k, d[1] * k, d[2] * k];

/** A toner recipe's tint at display luma l: its four nodes at 0, 1/3, 2/3, 1,
 *  interpolated linearly as tint vectors. */
export function recipeTint(toner: number, l: number): RGB {
  const def = TONERS[toner] ?? TONERS[0];
  const x = clamp01(l) * 3;
  const k = Math.min(Math.floor(x), 2);
  const f = x - k;
  const a = scaled(tintDirection(def.nodes[k][0]), def.nodes[k][1] * TINT_MAX);
  const b = scaled(tintDirection(def.nodes[k + 1][0]), def.nodes[k + 1][1] * TINT_MAX);
  return [a[0] * (1 - f) + b[0] * f, a[1] * (1 - f) + b[1] * f, a[2] * (1 - f) + b[2] * f];
}

/** Split toning's two tints at display luma l, kept apart so the stage can
 *  add them in the GLSL's order. */
export function splitTint(p: ToneParams, l: number): { shadows: RGB; highlights: RGB } {
  const pivot = 0.5 + (0.4 * p.balance) / 100;
  const wh = smoothstep(pivot - 0.3, pivot + 0.3, l);
  return {
    shadows: scaled(tintDirection(p.shHue), (1 - wh) * (p.shSat / 100) * TINT_MAX),
    highlights: scaled(tintDirection(p.hiHue), wh * (p.hiSat / 100) * TINT_MAX),
  };
}

/** The largest α in [0, 1] keeping c + α·t inside [0, 1]³. */
export function gamutAlpha(c: readonly number[], t: readonly number[]): number {
  let a = 1;
  for (let i = 0; i < 3; i++) {
    if (t[i] > 0) a = Math.min(a, (1 - c[i]) / t[i]);
    else if (t[i] < 0) a = Math.min(a, c[i] / -t[i]);
  }
  return Math.max(a, 0);
}

/** Paper reflectance: 1 in the paper hue's full channel, lower elsewhere. */
export function paperColour(hue: number, sat: number): RGB {
  const h = hueRgb(hue);
  const k = (sat / 100) * PAPER_MAX;
  return [1 - k * (1 - h[0]), 1 - k * (1 - h[1]), 1 - k * (1 - h[2])];
}

/** Whether a toner, split-tone colour or paper tint is set: the tone block's gate. */
export function toningActive(p: ToneParams): boolean {
  return TONING_KEYS.some((k) => p[k] !== 0);
}

/** The tone stage on one display pixel, treatment on. With no toning set it
 *  hands the pixel on untouched. Otherwise the input is clamped to [0, 1]³
 *  first, as the shader does: the host hands a stage that declares a space the
 *  unclipped display colour. */
export function tone(input: readonly number[], p: ToneParams): RGB {
  if (!toningActive(p)) return [input[0], input[1], input[2]];
  const c: RGB = [clamp01(input[0]), clamp01(input[1]), clamp01(input[2])];
  const l = luma(c);
  const r = recipeTint(p.toner, l);
  const strength = clamp01(p.tonerStrength / 100);
  const { shadows, highlights } = splitTint(p, l);
  const t: RGB = [
    r[0] * strength + shadows[0] + highlights[0],
    r[1] * strength + shadows[1] + highlights[1],
    r[2] * strength + shadows[2] + highlights[2],
  ];
  const a = gamutAlpha(c, t);
  // α = c/−t lands on the cube's face up to one rounding error; the clamp
  // keeps the output inside [0, 1] (an identity when there is no tint).
  let out: RGB = [clamp01(c[0] + a * t[0]), clamp01(c[1] + a * t[1]), clamp01(c[2] + a * t[2])];
  if (p.paperSat > 0) {
    const paper = paperColour(p.paperHue, p.paperSat);
    const w = clamp01(l);
    out = [
      out[0] * ((1 - w) + paper[0] * w),
      out[1] * ((1 - w) + paper[1] * w),
      out[2] * ((1 - w) + paper[2] * w),
    ];
  }
  return out;
}
