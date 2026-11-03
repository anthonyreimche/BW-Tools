import { describe, expect, it } from "vitest";
import type { FrameSample } from "../src/frame";
import { dragBands, sampleTarget } from "../src/target";

const ZERO = [0, 0, 0, 0, 0, 0, 0, 0];

describe("dragBands", () => {
  it("lightens the colour's band when dragged up, by 0.5 per px at full chroma", () => {
    expect(dragBands(ZERO, { hue: 0, sat: 1, chroma: 1 }, -20)).toEqual([10, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("splits the move between two bands half-way", () => {
    const out = dragBands(ZERO, { hue: 15, sat: 1, chroma: 1 }, 20);
    expect(out[0]).toBeCloseTo(-5, 12);
    expect(out[1]).toBeCloseTo(-5, 12);
  });
  it("ignores a near-grey colour", () => {
    expect(dragBands([5, 0, 0, 0, 0, 0, 0, 0], { hue: 0, sat: 0.01, chroma: 0.01 }, -100)).toEqual([5, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("clamps at ±100", () => {
    expect(dragBands([90, 0, 0, 0, 0, 0, 0, 0], { hue: 0, sat: 1, chroma: 1 }, -100)[0]).toBe(100);
  });
});

describe("sampleTarget", () => {
  it("reads the hue and chroma under the point", () => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let i = 0; i < 64; i++) data.set([255, 0, 0, 255], i * 4);
    const red: FrameSample = { data, width: 8, height: 8 };
    expect(sampleTarget(red, { x: 0.5, y: 0.5 })).toMatchObject({ hue: 0, chroma: 1 });
    expect(sampleTarget(null, { x: 0.5, y: 0.5 })).toBeNull();
    expect(sampleTarget(red, null)).toBeNull();
  });
});
