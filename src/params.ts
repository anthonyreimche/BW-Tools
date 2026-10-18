// Every number the extension stores lives in the per-photo paramBag under the
// two stages' qualified keys. FIELDS is the single list: the stages declare
// their uniforms from it, readParams reads and clamps from it, and every patch
// is built from it. The treatment flag exists in both stages (a stage only
// sees its own uniforms), so every write sets both; repairPatch mends a bag
// that arrived with only one (a preset saved from one stage's keys).

import type { ConvertParams, ToneParams } from "./model";
import { BAND_LABELS } from "./tables";

export const EXT_ID = "black-and-white";
export const CONVERT_ID = `${EXT_ID}.convert`;
export const TONE_ID = `${EXT_ID}.tone`;
export const PANEL_ID = `${EXT_ID}.panel`;
export const OVERLAY_ID = `${EXT_ID}.target`;
export const TOGGLE_ACTION = `${EXT_ID}.toggle`;

export interface BwParams extends ConvertParams, ToneParams {
  on: boolean;
}

export interface FieldSpec {
  stage: "convert" | "tone";
  key: string;
  type: "float" | "int";
  def: number;
  min: number;
  max: number;
  label: string;
}

export type NumericKey = Exclude<keyof BwParams, "on" | "bands">;

function spec(
  stage: FieldSpec["stage"],
  key: string,
  def: number,
  min: number,
  max: number,
  label: string,
  type: FieldSpec["type"] = "float",
): FieldSpec {
  return { stage, key, type, def, min, max, label };
}

const ON_CONVERT = spec("convert", "on", 0, 0, 1, "Black & White");
const ON_TONE = spec("tone", "on", 0, 0, 1, "Black & White");
const BAND_FIELDS = BAND_LABELS.map((label, i) => spec("convert", `band${i}`, 0, -100, 100, label));

const NUMERIC: { readonly [K in NumericKey]: FieldSpec } = {
  response: spec("convert", "response", 0, 0, 6, "Response", "int"),
  filterType: spec("convert", "filterType", 0, 0, 8, "Filter", "int"),
  filterStrength: spec("convert", "filterStrength", 100, 0, 100, "Filter strength"),
  mixR: spec("convert", "mixR", 21, -200, 200, "Custom red"),
  mixG: spec("convert", "mixG", 72, -200, 200, "Custom green"),
  mixB: spec("convert", "mixB", 7, -200, 200, "Custom blue"),
  keepHue: spec("convert", "keepHue", 0, 0, 360, "Keep hue"),
  keepRange: spec("convert", "keepRange", 30, 5, 90, "Keep range"),
  keepAmount: spec("convert", "keepAmount", 0, 0, 100, "Keep amount"),
  toner: spec("tone", "toner", 0, 0, 7, "Toner", "int"),
  tonerStrength: spec("tone", "tonerStrength", 100, 0, 100, "Toner strength"),
  hiHue: spec("tone", "hiHue", 40, 0, 360, "Highlights hue"),
  hiSat: spec("tone", "hiSat", 0, 0, 100, "Highlights saturation"),
  shHue: spec("tone", "shHue", 220, 0, 360, "Shadows hue"),
  shSat: spec("tone", "shSat", 0, 0, 100, "Shadows saturation"),
  balance: spec("tone", "balance", 0, -100, 100, "Balance"),
  paperHue: spec("tone", "paperHue", 40, 0, 360, "Paper hue"),
  paperSat: spec("tone", "paperSat", 0, 0, 100, "Paper saturation"),
};

const NUMERIC_KEYS = Object.keys(NUMERIC) as NumericKey[];
const numericFor = (stage: FieldSpec["stage"]) => NUMERIC_KEYS.map((k) => NUMERIC[k]).filter((f) => f.stage === stage);

/** Both stages' uniforms, in declaration order. */
export const FIELDS: readonly FieldSpec[] = [
  ON_CONVERT,
  ...numericFor("convert"),
  ...BAND_FIELDS,
  ON_TONE,
  ...numericFor("tone"),
];

export const qualified = (f: FieldSpec): string => `${f.stage === "convert" ? CONVERT_ID : TONE_ID}.${f.key}`;

export const KEY = {
  convertOn: qualified(ON_CONVERT),
  toneOn: qualified(ON_TONE),
} as const;

/** `v` clamped to the field's range (rounded for integer fields); the default
 *  for a value that isn't a finite number. Reads and writes both go through
 *  this: the shader sees the bag as written, so an out-of-range typed value
 *  must not get past the write. */
function fit(f: FieldSpec, v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return f.def;
  const c = Math.min(f.max, Math.max(f.min, v));
  return f.type === "int" ? Math.round(c) : c;
}

function value(bag: Record<string, unknown>, f: FieldSpec): number {
  return fit(f, bag[qualified(f)]);
}

export function readParams(bag: Record<string, unknown>): BwParams {
  const numeric = Object.fromEntries(NUMERIC_KEYS.map((k) => [k, value(bag, NUMERIC[k])])) as Record<NumericKey, number>;
  return { ...numeric, on: value(bag, ON_CONVERT) > 0.5, bands: BAND_FIELDS.map((f) => value(bag, f)) };
}

export const DEFAULTS: BwParams = readParams({});

export function treatmentPatch(on: boolean): Record<string, number> {
  const v = on ? 1 : 0;
  return { [KEY.convertOn]: v, [KEY.toneOn]: v };
}

/** Bag entries for the fields `next` sets; `on` writes both stages' flags. */
export function paramsPatch(next: Partial<BwParams>): Record<string, number> {
  const out: Record<string, number> = {};
  if (next.on !== undefined) Object.assign(out, treatmentPatch(next.on));
  next.bands?.forEach((b, i) => {
    out[qualified(BAND_FIELDS[i])] = fit(BAND_FIELDS[i], b);
  });
  for (const k of NUMERIC_KEYS) {
    const v = next[k];
    if (v !== undefined) out[qualified(NUMERIC[k])] = fit(NUMERIC[k], v);
  }
  return out;
}

/** One numeric field's bag entry. */
export function fieldPatch(key: NumericKey, v: number): Record<string, number> {
  return { [qualified(NUMERIC[key])]: fit(NUMERIC[key], v) };
}

export function resetPatch(): Record<string, number> {
  return paramsPatch(DEFAULTS);
}

export function isOn(bag: Record<string, unknown>): boolean {
  return value(bag, ON_CONVERT) > 0.5;
}

/** The tone flag set to match the convert flag, or null when they agree. */
export function repairPatch(bag: Record<string, unknown>): Record<string, number> | null {
  const on = isOn(bag);
  return on === value(bag, ON_TONE) > 0.5 ? null : { [KEY.toneOn]: on ? 1 : 0 };
}
