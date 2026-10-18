import { describe, expect, it } from "vitest";
import { linearAt, patchLinear, type FrameSample } from "../src/frame";
import { decodeSrgb } from "../src/model";

function frame(w: number, h: number, value: (x: number, y: number) => [number, number, number]): FrameSample {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const [r, g, b] = value(x, y);
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("frame readback", () => {
  it("reads one pixel in linear light", () => {
    const f = frame(2, 1, (x) => (x === 0 ? [255, 0, 128] : [0, 0, 0]));
    expect(linearAt(f, 0)).toEqual([1, 0, decodeSrgb(128 / 255)]);
  });

  it("averages a 5×5 box in linear light", () => {
    const f = frame(10, 10, (x) => (x % 2 === 0 ? [255, 255, 255] : [0, 0, 0]));
    const [r] = patchLinear(f, 0.55, 0.55)!;
    // Columns 3..7 around x = 5: three black (3, 5, 7) and two white (4, 6).
    expect(r).toBeCloseTo(2 / 5, 12);
  });

  it("clips the box at the frame's edges", () => {
    const f = frame(10, 10, (x, y) => (x === 0 && y === 0 ? [255, 255, 255] : [0, 0, 0]));
    const [r] = patchLinear(f, 0, 0)!;
    expect(r).toBeCloseTo(1 / 9, 12);
  });

  it("is null outside the image", () => {
    const f = frame(4, 4, () => [10, 10, 10]);
    expect(patchLinear(f, -0.01, 0.5)).toBeNull();
    expect(patchLinear(f, 0.5, 1.01)).toBeNull();
  });
});
