import { describe, expect, it } from "vitest";
import {
  gamutAlpha,
  hueRgb,
  luma,
  paperColour,
  recipeTint,
  tintDirection,
  tone,
  toningActive,
  type ToneParams,
} from "../src/model";
import { TINT_MAX, TONERS } from "../src/tables";

const OFF: ToneParams = {
  toner: 0,
  tonerStrength: 100,
  hiHue: 40,
  hiSat: 0,
  shHue: 220,
  shSat: 0,
  balance: 0,
  paperHue: 40,
  paperSat: 0,
};

function colours(n: number, seed = 11): [number, number, number][] {
  let s = seed >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, () => [next(), next(), next()] as [number, number, number]);
}

describe("hue colour and tint direction", () => {
  it("gives the pure colour at a hue", () => {
    expect(hueRgb(0)).toEqual([1, 0, 0]);
    expect(hueRgb(60)).toEqual([1, 1, 0]);
    expect(hueRgb(120)).toEqual([0, 1, 0]);
    expect(hueRgb(240)).toEqual([0, 0, 1]);
    expect(hueRgb(360)).toEqual([1, 0, 0]);
  });

  it("points away from grey with zero luma and a largest component of 1", () => {
    for (let hue = 0; hue < 360; hue += 10) {
      const d = tintDirection(hue);
      expect(Math.abs(luma(d))).toBeLessThan(1e-12);
      expect(Math.max(...d.map(Math.abs))).toBeCloseTo(1, 12);
    }
  });
});

describe("gamut guard", () => {
  it("allows the whole tint when it fits", () => {
    expect(gamutAlpha([0.5, 0.5, 0.5], [0.1, -0.05, -0.05])).toBe(1);
  });
  it("shrinks the tint to the nearest edge", () => {
    expect(gamutAlpha([0.95, 0.5, 0.5], [0.1, -0.05, -0.05])).toBeCloseTo(0.5, 12);
    expect(gamutAlpha([0.5, 0.02, 0.5], [0.1, -0.04, -0.05])).toBeCloseTo(0.5, 12);
  });
  it("allows nothing at white or black", () => {
    expect(gamutAlpha([1, 1, 1], [0.1, -0.05, -0.05])).toBe(0);
    expect(gamutAlpha([0, 0, 0], [0.1, -0.05, -0.05])).toBe(0);
  });
});

describe("toner recipes", () => {
  it("hit their end nodes exactly at luma 0 and 1", () => {
    const sepia = TONERS[1];
    const at0 = tintDirection(sepia.nodes[0][0]).map((v) => v * sepia.nodes[0][1] * TINT_MAX);
    const at1 = tintDirection(sepia.nodes[3][0]).map((v) => v * sepia.nodes[3][1] * TINT_MAX);
    recipeTint(1, 0).forEach((v, i) => expect(v).toBeCloseTo(at0[i], 12));
    recipeTint(1, 1).forEach((v, i) => expect(v).toBeCloseTo(at1[i], 12));
  });

  it("None tints nothing", () => {
    // `=== 0` rather than toEqual: a zero strength times a negative tint
    // component is -0, and toEqual tells -0 from +0.
    for (const l of [0, 0.3, 0.7, 1]) expect(recipeTint(0, l).every((v) => v === 0)).toBe(true);
  });
});

describe("tone", () => {
  it("is an exact no-op with every toning control off", () => {
    for (const c of colours(100)) expect(tone(c, OFF)).toEqual(c);
  });

  it("clips its input to [0, 1] first while toning is set, as the shader does", () => {
    const p = { ...OFF, toner: 1, hiSat: 60, shSat: 40, balance: 20, paperSat: 50 };
    expect(tone([1.7, -0.3, 0.4], p)).toEqual(tone([1, 0, 0.4], p));
    expect(tone([-2, 0.5, 3], p)).toEqual(tone([0, 0.5, 1], p));
    expect(tone([2, 2, 2], { ...OFF, paperSat: 1 })).toEqual(tone([1, 1, 1], { ...OFF, paperSat: 1 }));
  });

  it("leaves values outside [0, 1] alone with every toning control off", () => {
    expect(tone([2, 2, 2], OFF)).toEqual([2, 2, 2]);
    expect(tone([1.7, -0.3, 0.4], OFF)).toEqual([1.7, -0.3, 0.4]);
  });

  it("counts toning as set once a toner, split tone or paper tint is", () => {
    expect(toningActive(OFF)).toBe(false);
    expect(toningActive({ ...OFF, tonerStrength: 0, hiHue: 200, shHue: 10, balance: 50, paperHue: 90 })).toBe(false);
    for (const set of [{ toner: 3 }, { hiSat: 1 }, { shSat: 1 }, { paperSat: 1 }]) {
      expect(toningActive({ ...OFF, ...set })).toBe(true);
    }
  });

  it("keeps luma exactly for every toner, split and balance (paper off)", () => {
    for (let toner = 0; toner < TONERS.length; toner++) {
      for (const balance of [-100, 0, 100]) {
        const p = { ...OFF, toner, hiSat: 80, shSat: 60, balance };
        for (const c of colours(60)) expect(luma(tone(c, p))).toBeCloseTo(luma(c), 12);
      }
    }
  });

  it("stays inside [0, 1] with everything at full strength", () => {
    const p = { ...OFF, toner: 4, hiSat: 100, shSat: 100, paperSat: 100 };
    for (const c of colours(200)) for (const v of tone(c, p)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("paper tint only lowers channels and leaves the paper hue's full channel at white", () => {
    const p = { ...OFF, paperHue: 40, paperSat: 100 };
    for (const c of colours(60)) tone(c, p).forEach((v, i) => expect(v).toBeLessThanOrEqual(c[i]));
    const white = tone([1, 1, 1], p);
    expect(white[0]).toBe(1);
    expect(white[2]).toBeCloseTo(1 - 0.15, 12);
    expect(paperColour(40, 0)).toEqual([1, 1, 1]);
  });

  it("tints shadows with the shadow hue and highlights with the highlight hue", () => {
    const p = { ...OFF, shHue: 240, shSat: 100, hiHue: 30, hiSat: 100 };
    const dark = tone([0.1, 0.1, 0.1], p);
    const light = tone([0.8, 0.8, 0.8], p);
    expect(dark[2]).toBeGreaterThan(dark[0]);
    expect(light[0]).toBeGreaterThan(light[2]);
  });
});
