import { describe, expect, it } from "vitest";
import {
  bandWeight,
  conversionWeights,
  convert,
  decodeSrgb,
  encodeSrgb,
  hueChroma,
  hueOf,
  hueWindow,
  luma,
  type ConvertParams,
} from "../src/model";
import { FILTERS, RESPONSES } from "../src/tables";

const BASE: ConvertParams = {
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
};

/** Deterministic colours: a fixed-seed LCG, so failures reproduce. */
function colours(n: number, seed = 7): [number, number, number][] {
  let s = seed >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, () => [next(), next(), next()] as [number, number, number]);
}

// The four combinations whose filtered weights sum below WEIGHT_SUM_FLOOR.
const FLOORED = new Set(["5/8", "3/5", "4/4", "4/5"]);

describe("sRGB helpers", () => {
  it("match core's linearToSrgb and srgbToLinear", () => {
    expect(encodeSrgb(0.5)).toBeCloseTo(1.055 * Math.pow(0.5, 1 / 2.4) - 0.055, 15);
    expect(encodeSrgb(0.001)).toBeCloseTo(0.01292, 15);
    expect(encodeSrgb(2)).toBe(encodeSrgb(1));
    expect(encodeSrgb(-1)).toBe(0);
    expect(decodeSrgb(0.5)).toBeCloseTo(Math.pow(0.555 / 1.055, 2.4), 15);
    expect(decodeSrgb(0.02)).toBeCloseTo(0.02 / 12.92, 15);
  });
});

describe("conversion weights", () => {
  it("sum to 1 for every response × filter × strength except the four floored ones", () => {
    for (let response = 0; response < RESPONSES.length; response++) {
      for (let filterType = 0; filterType < FILTERS.length; filterType++) {
        for (const filterStrength of [0, 25, 50, 100]) {
          const w = conversionWeights({ ...BASE, response, filterType, filterStrength });
          const sum = w[0] + w[1] + w[2];
          if (filterStrength === 100 && FLOORED.has(`${response}/${filterType}`)) {
            expect(Math.abs(sum - 1)).toBeGreaterThan(1e-6);
          } else {
            expect(sum).toBeCloseTo(1, 12);
          }
        }
      }
    }
  });

  it("holds a negative sum at the floor instead of flipping sign (Infrared through Blue)", () => {
    const w = conversionWeights({ ...BASE, response: 5, filterType: 8, filterStrength: 100 });
    expect(w[0]).toBeCloseTo((0.55 * 0.05) / 0.05, 12);
    expect(w[1]).toBeCloseTo((0.95 * 0.2) / 0.05, 12);
    expect(w[2]).toBeCloseTo(-0.5 / 0.05, 12);
  });

  it("takes the Custom sliders as percentages", () => {
    const w = conversionWeights({ ...BASE, response: 6, mixR: 50, mixG: 30, mixB: 20 });
    expect(w).toEqual([0.5, 0.3, 0.2]);
  });

  it("falls back to Neutral for an unknown response or filter id", () => {
    expect(conversionWeights({ ...BASE, response: 42 })).toEqual(conversionWeights(BASE));
    expect(conversionWeights({ ...BASE, filterType: 42 })).toEqual(conversionWeights(BASE));
  });
});

describe("hue and chroma", () => {
  it("names the primaries and secondaries", () => {
    expect(hueOf([1, 0, 0])).toBe(0);
    expect(hueOf([1, 1, 0])).toBe(60);
    expect(hueOf([0, 1, 0])).toBe(120);
    expect(hueOf([0, 1, 1])).toBe(180);
    expect(hueOf([0, 0, 1])).toBe(240);
    expect(hueOf([1, 0, 1])).toBe(300);
    expect(hueOf([0.4, 0.4, 0.4])).toBe(0);
  });

  it("does not move with exposure", () => {
    for (const c of colours(200)) {
      const a = hueChroma(c);
      for (const k of [0.01, 3, 100]) {
        const b = hueChroma([c[0] * k, c[1] * k, c[2] * k]);
        expect(b.hue).toBeCloseTo(a.hue, 9);
        expect(b.sat).toBeCloseTo(a.sat, 9);
        expect(b.chroma).toBeCloseTo(a.chroma, 9);
      }
    }
  });

  it("gives black and grey no chroma, and a pure primary full chroma", () => {
    expect(hueChroma([0, 0, 0]).chroma).toBe(0);
    expect(hueChroma([1e-7, 0, 0]).chroma).toBe(0);
    // encodeSrgb(1) is 0.9999999999999999 (core's own 1.055·1 − 0.055), so a
    // grey's saturation is 1.1e-16 and its chroma 1.5e-31: zero in effect, not bit-exact.
    expect(hueChroma([0.3, 0.3, 0.3]).chroma).toBeCloseTo(0, 12);
    expect(hueChroma([0.5, 0, 0]).chroma).toBe(1);
  });

  it("clips negative channels to zero before taking the hue", () => {
    expect(hueChroma([0.5, -0.1, -0.2])).toEqual(hueChroma([0.5, 0, 0]));
  });
});

describe("band weights", () => {
  it("are a partition of unity around the circle", () => {
    for (let hue = 0; hue < 360; hue += 0.5) {
      let sum = 0;
      for (let b = 0; b < 8; b++) sum += bandWeight(hue, b);
      expect(sum).toBeCloseTo(1, 12);
    }
  });

  it("give a band full authority at its centre and split evenly half-way", () => {
    expect(bandWeight(120, 3)).toBe(1);
    expect(bandWeight(120, 2)).toBe(0);
    expect(bandWeight(15, 0)).toBeCloseTo(0.5, 12);
    expect(bandWeight(15, 1)).toBeCloseTo(0.5, 12);
    expect(bandWeight(340, 7)).toBeCloseTo(0.5, 12);
    expect(bandWeight(340, 0)).toBeCloseTo(0.5, 12);
  });

  it("selective-colour window is 1 at its centre, 0 at its edge, and wraps", () => {
    expect(hueWindow(10, 10, 30)).toBe(1);
    expect(hueWindow(40, 10, 30)).toBe(0);
    expect(hueWindow(355, 5, 30)).toBeCloseTo(hueWindow(15, 5, 30), 12);
  });
});

describe("convert", () => {
  it("keeps grey exactly grey for every non-floored response and filter", () => {
    for (let response = 0; response < RESPONSES.length; response++) {
      for (let filterType = 0; filterType < FILTERS.length; filterType++) {
        if (FLOORED.has(`${response}/${filterType}`)) continue;
        for (const g of [0.01, 0.18, 0.7, 2.5]) {
          const out = convert([g, g, g], { ...BASE, response, filterType, bands: [100, -100, 50, 0, 0, 0, 0, 0] });
          for (const v of out) expect(v).toBeCloseTo(g, 12);
        }
      }
    }
  });

  it("moves a saturated red by exactly MIX_EV stops at Red ±100", () => {
    const red: [number, number, number] = [0.5, 0, 0];
    const base = convert(red, BASE)[0];
    expect(convert(red, { ...BASE, bands: [-100, 0, 0, 0, 0, 0, 0, 0] })[0] / base).toBeCloseTo(0.25, 12);
    expect(convert(red, { ...BASE, bands: [100, 0, 0, 0, 0, 0, 0, 0] })[0] / base).toBeCloseTo(4, 12);
  });

  it("returns grey when nothing is kept", () => {
    for (const c of colours(50)) {
      const [r, g, b] = convert(c, BASE);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("keeps a colour's chromaticity at the converted luminance", () => {
    const c: [number, number, number] = [0.6, 0.1, 0.05];
    const p = { ...BASE, keepHue: hueChroma(c).hue, keepRange: 40, keepAmount: 100 };
    const grey = convert(c, BASE)[0];
    const out = convert(c, p);
    expect(luma(out)).toBeCloseTo(grey, 12);
    expect(out[1] / out[0]).toBeCloseTo(c[1] / c[0], 12);
    expect(out[2] / out[0]).toBeCloseTo(c[2] / c[0], 12);
  });

  it("clamps Y at zero for an out-of-gamut colour", () => {
    const out = convert([-0.4, 0.01, 0.0], { ...BASE, response: 6, mixR: 200, mixG: 0, mixB: 0 });
    expect(out).toEqual([0, 0, 0]);
  });
});
