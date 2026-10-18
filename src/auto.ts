// Auto for the eight-colour mix: the contrast-preserving decolorization
// energy of Lu, Xu & Jia, "Real-time Contrast Preserving Decolorization"
// (SIGGRAPH Asia 2012 Technical Briefs). Pixel pairs (neighbours on a
// half-size grid plus one random partner each) carry a target contrast δ, the
// colour distance; the energy rewards grey differences of ±δ. The paper
// searches 66 RGB weight triples; here the response and filter stay as the
// user set them and the eight band sliders are searched, by coordinate ascent
// over the slider grid, with a small pull toward zero. Deterministic: the
// random partners come from a fixed seed.

import type { FrameSample } from "./frame";
import { linearAt } from "./frame";
import { bandWeight, conversionWeights, encodeSrgb, hueChroma, type ConvertParams } from "./model";
import { MIX_EV } from "./tables";

export const SIGMA = 0.05;
export const LAMBDA = 0.02;
export const MIN_CONTRAST = 0.05;
const SWEEPS = 3;
const STEP = 10;

export interface AutoInput {
  /** max(dot(w, lin), 0) per pixel. */
  base: Float64Array;
  chroma: Float64Array;
  /** Eight band weights per pixel. */
  weights: Float64Array;
  /** Pixel index pairs, two per pair. */
  pairs: Int32Array;
  /** Target contrast per pair. */
  delta: Float64Array;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prepare(sample: FrameSample, p: ConvertParams, seed = 0x5eed): AutoInput {
  const { data, width, height } = sample;
  const n = width * height;
  const w = conversionWeights(p);
  const base = new Float64Array(n);
  const chroma = new Float64Array(n);
  const weights = new Float64Array(n * 8);
  for (let i = 0; i < n; i++) {
    const lin = linearAt(sample, i);
    base[i] = Math.max(w[0] * lin[0] + w[1] * lin[1] + w[2] * lin[2], 0);
    const hc = hueChroma(lin);
    chroma[i] = hc.chroma;
    for (let b = 0; b < 8; b++) weights[i * 8 + b] = bandWeight(hc.hue, b);
  }

  const pairs: number[] = [];
  const delta: number[] = [];
  const add = (a: number, b: number) => {
    const d =
      Math.hypot(data[a * 4] - data[b * 4], data[a * 4 + 1] - data[b * 4 + 1], data[a * 4 + 2] - data[b * 4 + 2]) /
      255 /
      Math.SQRT2;
    if (d < MIN_CONTRAST) return;
    pairs.push(a, b);
    delta.push(d);
  };

  const rnd = mulberry32(seed);
  const partner = Int32Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = partner[i];
    partner[i] = partner[j];
    partner[j] = t;
  }
  for (let i = 0; i < n; i++) add(i, partner[i]);
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = y * width + x;
      if (x + 2 < width) add(i, i + 2);
      if (y + 2 < height) add(i, i + 2 * width);
    }
  }
  return { base, chroma, weights, pairs: Int32Array.from(pairs), delta: Float64Array.from(delta) };
}

/** Mean log-likelihood of the pairs' grey differences, minus the pull to zero. */
export function energy(input: AutoInput, bands: readonly number[]): number {
  const n = input.base.length;
  const g = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0;
    for (let b = 0; b < 8; b++) a += (bands[b] / 100) * input.weights[i * 8 + b];
    g[i] = encodeSrgb(input.base[i] * Math.pow(2, MIX_EV * input.chroma[i] * a));
  }
  const m = input.delta.length;
  let sum = 0;
  for (let k = 0; k < m; k++) {
    const dg = g[input.pairs[2 * k]] - g[input.pairs[2 * k + 1]];
    const d = input.delta[k];
    const x = -((dg + d) ** 2) / (SIGMA * SIGMA);
    const y = -((dg - d) ** 2) / (SIGMA * SIGMA);
    // log(e^x + e^y) without underflow.
    sum += Math.max(x, y) + Math.log1p(Math.exp(-Math.abs(x - y)));
  }
  let pull = 0;
  for (const b of bands) pull += (b / 100) ** 2;
  return (m > 0 ? sum / m : 0) - LAMBDA * pull;
}

/** The band sliders that best keep the colours' contrast in grey. */
export function autoBands(sample: FrameSample, p: ConvertParams): number[] {
  const input = prepare(sample, p);
  const bands = [0, 0, 0, 0, 0, 0, 0, 0];
  let best = energy(input, bands);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (let b = 0; b < 8; b++) {
      let bestValue = bands[b];
      for (let v = -100; v <= 100; v += STEP) {
        if (v === bands[b]) continue;
        const trial = bands.slice();
        trial[b] = v;
        const e = energy(input, trial);
        if (e > best + 1e-12 || (Math.abs(e - best) <= 1e-12 && Math.abs(v) < Math.abs(bestValue))) {
          best = e;
          bestValue = v;
        }
      }
      bands[b] = bestValue;
    }
  }
  return bands;
}
