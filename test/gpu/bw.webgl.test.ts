// The two stages on the real renderer. Run via `npm run test:gpu`: run.cjs
// copies this file into a SafeLight checkout and runs it under its headless
// Chromium + SwiftShader rig. What the node suite can't check:
//
//  • the GLSL compiles and links with the host's uniform and helper
//    namespacing, for both process versions;
//  • an untouched photo and a photo in Colour treatment are bit-exact, on both
//    process versions (version 2 clips nothing upstream, so a stage that
//    clipped ahead of its gate would show here), and toning with every
//    control off leaves the converted image bit-exact;
//  • the shader matches the TS twin (model.ts) within half-float error.
//
// The probe pipeline hands scene-linear values straight to the framebuffer,
// but process version 1's tone chain still round-trips them through an 8-bit
// curve LUT (up to ~2e-3 off, most on dark values). The convert reference is
// therefore computed from the scene as the RGBA16F texture holds it, never
// from a stages-off capture: the hue maths amplifies that LUT error on dark,
// saturated colours past the tolerance. Toning acts on the displayed image,
// so its reference does start from the stages-off capture.

import { describe, expect, it } from "vitest";
import { CURRENT_PROCESS_VERSION, DEFAULT_GRAIN, DEFAULT_VIGNETTE } from "@/catalog/types";
import {
  LINEAR_PROBE_PIPELINE,
  builtinStages,
  floatImage,
  identityParams,
  rendererBuildError,
  withRenderer,
  type FloatImage,
  type Frame,
} from "@/rendering/webgl/webgl.test-support";
import { convert, tone, type RGB } from "@bw/model";
import { DEFAULTS, paramsPatch, type BwParams } from "@bw/params";
import { allStages, convertStage } from "@bw/stages";
import type { ProcessingStageContribution } from "@bw/safelight";

const W = 96;
const H = 64;
const V2 = { processVersion: CURRENT_PROCESS_VERSION };
const TOLERANCE = 4e-3;
// Past these the probe pipeline's knee and the output clip make a sample incomparable.
const LO = 0.002;
const HI = 0.8;

function hsv(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** Hue by column, four value/saturation bands by row, a grey ramp at the
 *  left. Luma stays under the probe pipeline's 0.85 shoulder knee, so the
 *  core tone chain is the identity on it. */
const SCENE = floatImage(W, H, (x, y) => {
  if (x < 6) {
    const g = 0.05 + (0.6 * y) / H;
    return [g, g, g];
  }
  const band = Math.floor((4 * y) / H);
  const v = [0.08, 0.22, 0.45, 0.7][band];
  const s = [0.9, 0.6, 0.85, 0.4][band];
  return hsv((360 * (x - 6)) / (W - 6), s, v);
});

/** Over-range display values on process version 2, which clips nothing
 *  upstream: scene-linear channels past white (above the probe's shoulder) and
 *  colours outside sRGB, with strongly negative channels. */
const WIDE_SCENE = floatImage(W, H, (x, y) => {
  const u = x / (W - 1);
  const v = y / (H - 1);
  if (y < H / 4) return [0.5 + 3.5 * u, 0.3 + 2.2 * u, 0.2 + 1.4 * u];
  if (y < H / 2) return [0.2 + 1.2 * u, -0.05 - 0.45 * v, 0.1 + 0.9 * u];
  if (y < (3 * H) / 4) return [-0.2 - 0.3 * u, 0.4 + 0.8 * v, -0.1 - 0.4 * v];
  return [0.05 + 0.8 * u, 0.05 + 0.8 * u, 0.05 + 0.8 * u];
});

function frames(
  stages: ProcessingStageContribution[],
  bags: Record<string, unknown>[],
  over: Record<string, unknown> = {},
  scene: FloatImage = SCENE,
): Frame[] {
  return withRenderer({ stages: [...builtinStages(), ...stages], pipeline: LINEAR_PROBE_PIPELINE }, (r) => {
    r.setImage(scene);
    r.setParams(identityParams(over));
    return bags.map((bag) => {
      r.setContributedParams(bag);
      const f = r.captureFloatFrame();
      if (!f) throw new Error("captureFloatFrame returned null");
      return f;
    });
  });
}

function expectBitExact(a: Frame, b: Frame): void {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let differing = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differing++;
  expect(differing).toBe(0);
}

interface Score {
  worst: number;
  changeRms: number;
  compared: number;
  where: string;
}

/** Round to the nearest half float, the precision the source texture stores. */
function toHalf(x: number): number {
  if (x === 0) return 0;
  const quantum = 2 ** (Math.max(Math.floor(Math.log2(Math.abs(x))), -14) - 10);
  return Math.round(x / quantum) * quantum;
}

const sceneAt = (p: number): RGB => [toHalf(SCENE.data[p * 4]), toHalf(SCENE.data[p * 4 + 1]), toHalf(SCENE.data[p * 4 + 2])];
const frameAt = (f: Frame) => (p: number): RGB => [f.data[p * 4], f.data[p * 4 + 1], f.data[p * 4 + 2]];

/** `input(p)` is the colour the stage under test receives at pixel p. */
function score(on: Frame, input: (p: number) => RGB, ref: (px: RGB) => RGB): Score {
  let worst = 0;
  let change = 0;
  let n = 0;
  let where = "";
  for (let p = 0; p < on.width * on.height; p++) {
    const px = input(p);
    const want = ref(px);
    if (want.some((v) => v < LO || v > HI)) continue;
    n++;
    for (let ch = 0; ch < 3; ch++) {
      const got = on.data[p * 4 + ch];
      const e = Math.abs(got - want[ch]);
      change += (want[ch] - px[ch]) ** 2;
      if (e > worst) {
        worst = e;
        where = `x=${p % on.width} y=${Math.floor(p / on.width)} ch=${ch} in=${px[ch].toFixed(4)} want=${want[ch].toFixed(4)} got=${got.toFixed(4)}`;
      }
    }
  }
  return { worst, changeRms: Math.sqrt(change / Math.max(3 * n, 1)), compared: n, where };
}

const bw = (over: Partial<BwParams>): BwParams => ({ ...DEFAULTS, on: true, ...over });

const CONVERSIONS: [string, BwParams][] = [
  ["Neutral", bw({})],
  ["Panchromatic through Red", bw({ response: 1, filterType: 4 })],
  ["Infrared", bw({ response: 5 })],
  ["Custom through half Yellow", bw({ response: 6, mixR: 60, mixG: 30, mixB: 10, filterType: 1, filterStrength: 50 })],
  ["Eight-band mix", bw({ bands: [-100, -40, 30, 80, 0, -80, 20, 60] })],
  ["Keep red", bw({ keepHue: 0, keepRange: 40, keepAmount: 100 })],
];

const TONINGS: [string, BwParams][] = [
  ["Sepia", bw({ toner: 1 })],
  ["Selenium at 60 %", bw({ toner: 2, tonerStrength: 60 })],
  ["Cyanotype", bw({ toner: 4 })],
  ["Split", bw({ hiHue: 40, hiSat: 50, shHue: 220, shSat: 60, balance: 30 })],
  ["Paper", bw({ paperHue: 40, paperSat: 100 })],
  ["Everything", bw({ toner: 7, hiSat: 30, shSat: 30, paperSat: 50, balance: -40 })],
];

describe("Black & White stages on the real renderer", () => {
  it("compile and link for both process versions", () => {
    expect(rendererBuildError({ stages: [...builtinStages(), ...allStages()], pipeline: LINEAR_PROBE_PIPELINE })).toBeNull();
  });

  it("are bit-exact no-ops when untouched or in Colour treatment", () => {
    const [bare] = frames([], [{}]);
    const colour = paramsPatch({
      ...DEFAULTS,
      on: false,
      bands: [100, -100, 50, 0, 0, 0, 0, 0],
      toner: 1,
      hiSat: 80,
      paperSat: 60,
      keepAmount: 100,
    });
    const [idle, off] = frames(allStages(), [{}, colour]);
    expectBitExact(idle, bare);
    expectBitExact(off, bare);
  });

  // A display stage that declares no space is clipped to [0, 1] by the host on
  // version 2, ahead of its block and outside its gate. The tone stage declares
  // the display's own space, so the host adds no clip, and the Vignette and
  // Grain behind it read the unclipped values. A bare no-op stage that declares
  // nothing is the positive control: it must change this frame, or the scene
  // doesn't reach the display phase over range and the test proves nothing.
  it("are bit-exact no-ops on version 2 with values outside [0, 1] ahead of Vignette and Grain", () => {
    const over = {
      ...V2,
      vignette: { ...DEFAULT_VIGNETTE, amount: 30 },
      grain: { ...DEFAULT_GRAIN, amount: 100 },
    };
    const colour = paramsPatch({ ...DEFAULTS, on: false, bands: [100, -100, 50, 0, 0, 0, 0, 0], toner: 1, hiSat: 80, paperSat: 60 });
    const clipsAhead: ProcessingStageContribution = {
      id: "test.clips-ahead",
      name: "Clips ahead",
      phase: "display-adjust",
      priority: 100,
      glsl: "c = c;",
      uniforms: [],
    };
    const [bare] = frames([], [{}], over, WIDE_SCENE);
    const [clipped] = frames([clipsAhead], [{}], over, WIDE_SCENE);
    let moved = 0;
    for (let i = 0; i < bare.data.length; i++) if (bare.data[i] !== clipped.data[i]) moved++;
    expect(moved).toBeGreaterThan(W * H * 0.1);
    const [idle, off] = frames(allStages(), [{}, colour], over, WIDE_SCENE);
    expectBitExact(idle, bare);
    expectBitExact(off, bare);
  });

  it("leaves the converted image bit-exact when every toning control is off", () => {
    const [withTone] = frames(allStages(), [paramsPatch(bw({}))]);
    const [convertOnly] = frames([convertStage()], [paramsPatch(bw({}))]);
    expectBitExact(withTone, convertOnly);
  });

  // Treatment on writes both stages' `on` flags, so with no toner, split tone
  // or paper tint set the tone stage must still hand the conversion on with
  // its range, greys over white included, to the Vignette and Grain behind it.
  // A grey is a luminance, which the core shoulder keeps under white, so the
  // probe transform skips the shoulder. The positive control is a no-space
  // display stage, which the host clips ahead of.
  it("leaves an over-range conversion bit-exact on version 2 when no toning is set", () => {
    const openProbe = { ...LINEAR_PROBE_PIPELINE, id: "test.open-probe", sig: "test.open-probe", skipToneShoulder: true };
    const over = {
      ...V2,
      vignette: { ...DEFAULT_VIGNETTE, amount: 30 },
      grain: { ...DEFAULT_GRAIN, amount: 100 },
    };
    const clipsAhead: ProcessingStageContribution = {
      id: "test.clips-ahead",
      name: "Clips ahead",
      phase: "display-adjust",
      priority: 100,
      glsl: "c = c;",
      uniforms: [],
    };
    const frame = (stages: ProcessingStageContribution[]): Frame =>
      withRenderer({ stages: [...builtinStages(), ...stages], pipeline: openProbe }, (r) => {
        r.setImage(WIDE_SCENE);
        r.setParams(identityParams(over));
        r.setContributedParams(paramsPatch(bw({})));
        const f = r.captureFloatFrame();
        if (!f) throw new Error("captureFloatFrame returned null");
        return f;
      });
    const convertOnly = frame([convertStage()]);
    const clipped = frame([convertStage(), clipsAhead]);
    let moved = 0;
    for (let i = 0; i < convertOnly.data.length; i++) if (convertOnly.data[i] !== clipped.data[i]) moved++;
    expect(moved).toBeGreaterThan(W * H * 0.1);
    expectBitExact(frame(allStages()), convertOnly);
  });

  for (const [version, over] of [["v1", {}], ["v2", V2]] as const) {
    it(`converts as the TS twin does (${version})`, () => {
      const ons = frames([convertStage()], CONVERSIONS.map(([, p]) => paramsPatch(p)), over);
      CONVERSIONS.forEach(([name, p], i) => {
        const s = score(ons[i], sceneAt, (px) => convert(px, p));
        console.log(
          `[bw-gpu] ${version} ${name}: worst ${s.worst.toExponential(2)}, change rms ${s.changeRms.toExponential(2)}, ${s.compared} px; ${s.where}`,
        );
        expect(s.compared).toBeGreaterThan(W * H * 0.25);
        expect(s.changeRms).toBeGreaterThan(1e-3);
        expect(s.worst).toBeLessThan(TOLERANCE);
      });
    });

    it(`tones as the TS twin does (${version})`, () => {
      const [off, ...ons] = frames(allStages(), [{}, ...TONINGS.map(([, p]) => paramsPatch(p))], over);
      TONINGS.forEach(([name, p], i) => {
        const s = score(ons[i], frameAt(off), (px) => tone(convert(px, p), p));
        console.log(
          `[bw-gpu] ${version} ${name}: worst ${s.worst.toExponential(2)}, change rms ${s.changeRms.toExponential(2)}, ${s.compared} px; ${s.where}`,
        );
        expect(s.compared).toBeGreaterThan(W * H * 0.25);
        expect(s.changeRms).toBeGreaterThan(1e-3);
        expect(s.worst).toBeLessThan(TOLERANCE);
      });
    });
  }
});
