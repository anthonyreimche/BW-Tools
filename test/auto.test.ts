import { describe, expect, it } from "vitest";
import { LAMBDA, MIN_CONTRAST, SIGMA, autoBands, energy, mulberry32, prepare, type AutoInput } from "../src/auto";
import type { FrameSample } from "../src/frame";
import { linearAt } from "../src/frame";
import { convert, encodeSrgb, type ConvertParams, type RGB } from "../src/model";

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

/** An 8-bit frame from linear colours, the way a captured frame arrives. */
function frameOf(w: number, h: number, colour: (x: number, y: number) => RGB): FrameSample {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const c = colour(x, y);
    for (let ch = 0; ch < 3; ch++) data[o + ch] = Math.round(encodeSrgb(c[ch]) * 255);
    data[o + 3] = 255;
  }
  return { data, width: w, height: h };
}

// Red and green with equal Rec.709 luminance: a plain conversion makes them one grey.
const RED: RGB = [0.5, 0.05, 0.05];
const GREEN: RGB = [0.05, 0.1838, 0.05];
const halves = frameOf(64, 64, (x) => (x < 32 ? RED : GREEN));
// Three colours: one sweep of the sliders isn't enough here, and a band ends up negative.
const BLUE: RGB = [0.04, 0.04, 0.5];
const thirds = frameOf(48, 48, (x, y) => [RED, GREEN, BLUE][(Math.floor(x / 8) + Math.floor(y / 16)) % 3]);

const grey = (f: FrameSample, i: number, bands: readonly number[]) =>
  encodeSrgb(convert(linearAt(f, i), { ...BASE, bands })[0]);

describe("Auto", () => {
  it("starts from two colours a plain conversion can't tell apart", () => {
    expect(Math.abs(grey(halves, 0, BASE.bands) - grey(halves, 63, BASE.bands))).toBeLessThan(0.02);
  });

  it("separates them", () => {
    const bands = autoBands(halves, BASE);
    expect(Math.abs(grey(halves, 0, bands) - grey(halves, 63, bands))).toBeGreaterThan(0.1);
  });

  it("scores separated greys higher", () => {
    const input = prepare(halves, BASE);
    expect(energy(input, [100, 0, 0, 0, 0, 0, 0, 0])).toBeGreaterThan(energy(input, [0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it("leaves every band at 0 on a grey image", () => {
    const flat = frameOf(64, 64, (x, y) => {
      const g = 0.05 + (0.5 * (x + y)) / 128;
      return [g, g, g];
    });
    // Lightness pairs remain; the bands can't act on them because grey has no chroma.
    expect(Math.max(...prepare(flat, BASE).chroma)).toBeLessThan(1e-12);
    expect(autoBands(flat, BASE)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("is deterministic and lands on the slider grid", () => {
    for (const f of [halves, thirds]) {
      const a = autoBands(f, BASE);
      expect(autoBands(f, BASE)).toEqual(a);
      for (const b of a) {
        expect(Math.abs(b) % 10).toBe(0);
        expect(Math.abs(b)).toBeLessThanOrEqual(100);
      }
    }
  });

  it("settles where no single slider move on the grid scores higher", () => {
    const input = prepare(thirds, BASE);
    const bands = autoBands(thirds, BASE);
    const here = energy(input, bands);
    for (let b = 0; b < 8; b++) {
      for (let v = -100; v <= 100; v += 10) {
        expect(energy(input, bands.map((x, i) => (i === b ? v : x)))).toBeLessThanOrEqual(here + 1e-9);
      }
    }
  });
});

describe("Auto's energy and pairs", () => {
  const raw = (w: number, h: number, value: (i: number) => number[]): FrameSample => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([...value(i), 255], i * 4);
    return { data, width: w, height: h };
  };
  const pairList = (input: AutoInput) => Array.from(input.delta, (_, k) => [input.pairs[2 * k], input.pairs[2 * k + 1]]);
  const colourDist = (f: FrameSample, a: number, b: number) =>
    Math.hypot(f.data[a * 4] - f.data[b * 4], f.data[a * 4 + 1] - f.data[b * 4 + 1], f.data[a * 4 + 2] - f.data[b * 4 + 2]) /
    255 /
    Math.SQRT2;
  // 6×4 grey ramp, 11 steps a pixel: any two different pixels clear MIN_CONTRAST.
  const ramp = raw(6, 4, (i) => [11 * i, 11 * i, 11 * i]);

  it("keeps the spec constants", () => {
    expect([SIGMA, LAMBDA, MIN_CONTRAST]).toEqual([0.05, 0.02, 0.05]);
  });

  it("pairs the half-size grid's right and lower neighbours, plus one random partner a pixel", () => {
    const pairs = pairList(prepare(ramp, BASE));
    for (const g of [[0, 2], [0, 12], [2, 4], [2, 14], [4, 16], [12, 14], [14, 16]]) {
      const at = pairs.findIndex(([a, b]) => a === g[0] && b === g[1]);
      expect(at, `grid pair ${g}`).toBeGreaterThanOrEqual(0);
      pairs.splice(at, 1);
    }
    // The rest is the shuffle, a permutation bar the fixed points (their δ is 0).
    expect(pairs.length).toBeGreaterThanOrEqual(24 - 2);
    expect(new Set(pairs.map((p) => p[0])).size).toBe(pairs.length);
    expect(new Set(pairs.map((p) => p[1])).size).toBe(pairs.length);
  });

  it("targets each pair's colour distance and drops the pairs under MIN_CONTRAST", () => {
    const input = prepare(ramp, BASE);
    pairList(input).forEach(([a, b], k) => expect(input.delta[k]).toBeCloseTo(colourDist(ramp, a, b), 12));
    const k = pairList(input).findIndex(([a, b]) => a === 0 && b === 2);
    expect(input.delta[k]).toBeCloseTo((22 * Math.sqrt(3)) / (255 * Math.SQRT2), 12);
    // One red pixel on black: 18 steps is δ 0.0499, 19 steps is 0.0527.
    const spot = (steps: number) => raw(6, 4, (i) => [i === 0 ? steps : 0, 0, 0]);
    expect(prepare(spot(18), BASE).delta.length).toBe(0);
    const kept = prepare(spot(19), BASE);
    expect(kept.delta.length).toBeGreaterThan(0);
    expect(pairList(kept).every((p) => p.includes(0))).toBe(true);
  });

  it("draws the same partners for the same seed and others for another", () => {
    expect(prepare(ramp, BASE).pairs).toEqual(prepare(ramp, BASE).pairs);
    expect(prepare(ramp, BASE, 1).pairs).not.toEqual(prepare(ramp, BASE).pairs);
  });

  it("mulberry32 stays in [0, 1) and keeps its stream", () => {
    const r = mulberry32(1);
    expect([r(), r(), r()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    const v = Array.from({ length: 1000 }, mulberry32(7));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v)).toBeLessThan(1);
  });

  it("scores pairs by the log-likelihood, averaged, minus the pull toward zero", () => {
    const f = frameOf(3, 1, (x) => [RED, GREEN, [0.05, 0.05, 0.5] as RGB][x]);
    const bands = [20, 0, 0, -30, 0, 40, 0, 0];
    const term = (a: number, b: number) => {
      const dg = grey(f, a, bands) - grey(f, b, bands);
      const d = colourDist(f, a, b);
      const x = -((dg + d) ** 2) / SIGMA ** 2;
      const y = -((dg - d) ** 2) / SIGMA ** 2;
      return Math.max(x, y) + Math.log1p(Math.exp(-Math.abs(x - y)));
    };
    const input: AutoInput = {
      ...prepare(f, BASE),
      pairs: Int32Array.of(0, 1, 1, 2),
      delta: Float64Array.of(colourDist(f, 0, 1), colourDist(f, 1, 2)),
    };
    const pull = bands.reduce((sum, b) => sum + (b / 100) ** 2, 0);
    expect(energy(input, bands)).toBeCloseTo((term(0, 1) + term(1, 2)) / 2 - LAMBDA * pull, 10);
  });

  it("is only the pull toward zero when there are no pairs", () => {
    const none: AutoInput = { ...prepare(halves, BASE), pairs: new Int32Array(0), delta: new Float64Array(0) };
    expect(energy(none, [100, -50, 0, 0, 0, 0, 0, 30])).toBeCloseTo(-LAMBDA * (1 + 0.25 + 0.09), 12);
  });
});
