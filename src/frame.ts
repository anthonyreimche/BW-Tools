// An 8-bit sRGB readback of a rendered frame, read in linear light.

import { decodeSrgb, type RGB } from "./model";

export interface FrameSample {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const DECODE = Float64Array.from({ length: 256 }, (_, i) => decodeSrgb(i / 255));

/** Core's eyedropper patch. */
export const PATCH = 5;

export function linearAt(sample: FrameSample, i: number): RGB {
  const o = i * 4;
  return [DECODE[sample.data[o]], DECODE[sample.data[o + 1]], DECODE[sample.data[o + 2]]];
}

/** The PATCH×PATCH box around image point (u, v), averaged in linear light;
 *  null outside the image. */
export function patchLinear(sample: FrameSample, u: number, v: number): RGB | null {
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;
  const { width, height } = sample;
  const px = Math.min(width - 1, Math.floor(u * width));
  const py = Math.min(height - 1, Math.floor(v * height));
  const half = PATCH >> 1;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = Math.max(0, py - half); y <= Math.min(height - 1, py + half); y++) {
    for (let x = Math.max(0, px - half); x <= Math.min(width - 1, px + half); x++) {
      const c = linearAt(sample, y * width + x);
      r += c[0];
      g += c[1];
      b += c[2];
      n++;
    }
  }
  return [r / n, g / n, b / n];
}
