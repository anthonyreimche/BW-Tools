import { describe, expect, it } from "vitest";
import {
  CONVERT_ID,
  DEFAULTS,
  FIELDS,
  KEY,
  TONE_ID,
  fieldPatch,
  isOn,
  paramsPatch,
  qualified,
  readParams,
  repairPatch,
  resetPatch,
  treatmentPatch,
} from "../src/params";

// The GLSL ES 3.00 reserved words that a short key could plausibly collide with.
const RESERVED = ["filter", "sample", "input", "output", "active", "common", "partition", "half", "fixed", "long", "short", "double", "class", "union", "enum", "template", "this", "goto", "inline", "public", "static", "extern", "external", "interface", "namespace", "using", "cast", "sizeof"];

describe("fields", () => {
  it("default to the spec's values", () => {
    expect(DEFAULTS).toEqual({
      on: false,
      response: 0,
      filterType: 0,
      filterStrength: 100,
      mixR: 21,
      mixG: 72,
      mixB: 7,
      bands: [0, 0, 0, 0, 0, 0, 0, 0],
      keepHue: 0,
      keepRange: 30,
      keepAmount: 0,
      toner: 0,
      tonerStrength: 100,
      hiHue: 40,
      hiSat: 0,
      shHue: 220,
      shSat: 0,
      balance: 0,
      paperHue: 40,
      paperSat: 0,
    });
  });

  it("are unique per stage and never a GLSL reserved word", () => {
    for (const stage of ["convert", "tone"] as const) {
      const keys = FIELDS.filter((f) => f.stage === stage).map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(RESERVED).not.toContain(k);
    }
    expect(FIELDS.filter((f) => f.stage === "convert").length).toBe(18);
    expect(FIELDS.filter((f) => f.stage === "tone").length).toBe(10);
  });

  it("qualify keys by stage", () => {
    const on = FIELDS.filter((f) => f.key === "on").map(qualified);
    expect(on).toEqual([`${CONVERT_ID}.on`, `${TONE_ID}.on`]);
    expect(KEY).toEqual({ convertOn: `${CONVERT_ID}.on`, toneOn: `${TONE_ID}.on` });
  });
});

describe("readParams", () => {
  it("clamps to each field's range and rounds integer fields", () => {
    const p = readParams({
      [`${CONVERT_ID}.response`]: 9,
      [`${CONVERT_ID}.filterType`]: 2.6,
      [`${CONVERT_ID}.band0`]: -150,
      [`${TONE_ID}.balance`]: 300,
    });
    expect(p.response).toBe(6);
    expect(p.filterType).toBe(3);
    expect(p.bands[0]).toBe(-100);
    expect(p.balance).toBe(100);
  });

  it("falls back to the default for missing, NaN or non-number values", () => {
    const p = readParams({
      [`${CONVERT_ID}.filterStrength`]: "x",
      [`${CONVERT_ID}.mixR`]: Number.NaN,
      [`${TONE_ID}.hiHue`]: null,
    });
    expect(p.filterStrength).toBe(100);
    expect(p.mixR).toBe(21);
    expect(p.hiHue).toBe(40);
  });

  it("reads the treatment from the convert stage", () => {
    expect(readParams({ [KEY.convertOn]: 1 }).on).toBe(true);
    expect(readParams({ [KEY.toneOn]: 1 }).on).toBe(false);
    expect(isOn({ [KEY.convertOn]: 1 })).toBe(true);
    expect(isOn({})).toBe(false);
  });
});

describe("patches", () => {
  it("write both treatment flags together", () => {
    expect(treatmentPatch(true)).toEqual({ [KEY.convertOn]: 1, [KEY.toneOn]: 1 });
    expect(treatmentPatch(false)).toEqual({ [KEY.convertOn]: 0, [KEY.toneOn]: 0 });
    expect(paramsPatch({ on: true })).toEqual({ [KEY.convertOn]: 1, [KEY.toneOn]: 1 });
  });

  it("write only the fields given", () => {
    expect(paramsPatch({ hiHue: 10 })).toEqual({ [`${TONE_ID}.hiHue`]: 10 });
    expect(fieldPatch("hiHue", 10)).toEqual({ [`${TONE_ID}.hiHue`]: 10 });
    expect(fieldPatch("response", 3)).toEqual({ [`${CONVERT_ID}.response`]: 3 });
    expect(paramsPatch({ bands: [1, 2, 3, 4, 5, 6, 7, 8] })).toEqual(
      Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => [`${CONVERT_ID}.band${i}`, v])),
    );
  });

  it("clamp to each field's range and round integer fields when written", () => {
    // Core's Slider passes any finite typed number to onChange; readParams
    // would clamp it on read, but the shader reads the bag as written.
    expect(fieldPatch("hiSat", 500)).toEqual({ [`${TONE_ID}.hiSat`]: 100 });
    expect(fieldPatch("balance", -999)).toEqual({ [`${TONE_ID}.balance`]: -100 });
    expect(fieldPatch("response", 2.6)).toEqual({ [`${CONVERT_ID}.response`]: 3 });
    expect(fieldPatch("keepRange", 1)).toEqual({ [`${CONVERT_ID}.keepRange`]: 5 });
    expect(paramsPatch({ paperSat: -20, toner: 9 })).toEqual({
      [`${TONE_ID}.paperSat`]: 0,
      [`${TONE_ID}.toner`]: 7,
    });
    const bands = paramsPatch({ bands: [500, -500, 0, 0, 0, 0, 0, 0] });
    expect(bands[`${CONVERT_ID}.band0`]).toBe(100);
    expect(bands[`${CONVERT_ID}.band1`]).toBe(-100);
    expect(bands[`${CONVERT_ID}.band2`]).toBe(0);
  });

  it("never write a non-finite value", () => {
    expect(fieldPatch("hiSat", Number.NaN)).toEqual({ [`${TONE_ID}.hiSat`]: 0 });
    expect(fieldPatch("balance", Number.POSITIVE_INFINITY)).toEqual({ [`${TONE_ID}.balance`]: 0 });
  });

  it("round-trip through readParams", () => {
    const p = { ...DEFAULTS, on: true, response: 3, bands: [10, -20, 30, -40, 50, -60, 70, -80], toner: 2, paperSat: 40 };
    expect(readParams(paramsPatch(p))).toEqual(p);
  });

  it("reset writes every field's default", () => {
    const patch = resetPatch();
    expect(Object.keys(patch).sort()).toEqual(FIELDS.map(qualified).sort());
    for (const f of FIELDS) expect(patch[qualified(f)]).toBe(f.def);
  });
});

describe("repairPatch", () => {
  it("copies the convert flag onto the tone flag when they disagree", () => {
    expect(repairPatch({ [KEY.convertOn]: 1 })).toEqual({ [KEY.toneOn]: 1 });
    expect(repairPatch({ [KEY.toneOn]: 1 })).toEqual({ [KEY.toneOn]: 0 });
  });
  it("leaves agreeing flags alone", () => {
    expect(repairPatch({})).toBeNull();
    expect(repairPatch(treatmentPatch(true))).toBeNull();
    expect(repairPatch(treatmentPatch(false))).toBeNull();
  });
});
