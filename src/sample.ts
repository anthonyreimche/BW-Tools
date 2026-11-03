// The open photo's original colours: rendered off-screen with both B&W stages
// bypassed (the photo as the convert stage receives it, give or take the
// display transform), read back small. Auto reads colours from a whole-photo
// render, the target tool from a capture of the live view; neither touches it.

import type { FrameSample } from "./frame";
import { KEY } from "./params";
import { api } from "./runtime";
import type { DevelopParams, DevelopStoreState } from "./safelight";

export const TARGET_LONG_EDGE = 256;
export const AUTO_LONG_EDGE = 64;

let scratch: OffscreenCanvas | null = null;

/** Draw a frame at ≤ longEdge and read it back; null for a blank (the host's
 *  1×1 "no renderer" bitmap). */
export function readbackBitmap(bitmap: ImageBitmap, longEdge: number): FrameSample | null {
  const { width: bw, height: bh } = bitmap;
  if (bw < 2 || bh < 2) return null;
  const scale = Math.min(1, longEdge / Math.max(bw, bh));
  const w = Math.max(1, Math.round(bw * scale));
  const h = Math.max(1, Math.round(bh * scale));
  if (!scratch) scratch = new OffscreenCanvas(w, h);
  if (scratch.width !== w) scratch.width = w;
  if (scratch.height !== h) scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

export function originalBag(bag: Record<string, unknown>): Record<string, unknown> {
  return { ...bag, [KEY.convertOn]: 0, [KEY.toneOn]: 0 };
}

export interface OriginalDeps {
  develop(): DevelopStoreState;
  render(photoId: string, params: DevelopParams, bag: Record<string, unknown>): Promise<ImageBitmap | null>;
  readback(bitmap: ImageBitmap, longEdge: number): FrameSample | null;
}

export function liveOriginalDeps(): OriginalDeps {
  const a = api();
  return {
    develop: () => a.stores.useDevelopStore.getState(),
    render: (photoId, params, bag) => a.develop.renderPhotoFrame(photoId, params, bag),
    readback: readbackBitmap,
  };
}

/** A readback of the live view and the canvas size it was drawn at. */
export interface Captured {
  sample: FrameSample;
  width: number;
  height: number;
}

export interface CaptureDeps {
  develop(): DevelopStoreState;
  capture(params: DevelopParams, bag: Record<string, unknown>): Promise<ImageBitmap>;
  readback(bitmap: ImageBitmap, longEdge: number): FrameSample | null;
}

export function liveCaptureDeps(): CaptureDeps {
  const a = api();
  return {
    develop: () => a.stores.useDevelopStore.getState(),
    capture: (params, bag) => a.develop.captureFrame(params, { paramBag: bag }),
    readback: readbackBitmap,
  };
}

/** The live view with both B&W stages bypassed, aligned to the canvas, so a
 *  canvas point reads the original colour under it. */
export async function captureOriginal(
  longEdge: number,
  deps: CaptureDeps = liveCaptureDeps(),
): Promise<Captured | null> {
  const s = deps.develop();
  if (!s.photoId) return null;
  const bitmap = await deps.capture(s.previewParams ?? s.params, {
    [KEY.convertOn]: 0,
    [KEY.toneOn]: 0,
  });
  try {
    const sample = deps.readback(bitmap, longEdge);
    return sample ? { sample, width: bitmap.width, height: bitmap.height } : null;
  } finally {
    bitmap.close();
  }
}

export async function renderOriginal(
  longEdge: number,
  deps: OriginalDeps = liveOriginalDeps(),
): Promise<FrameSample | null> {
  const s = deps.develop();
  if (!s.photoId) return null;
  const bitmap = await deps.render(s.photoId, s.previewParams ?? s.params, originalBag(s.paramBag));
  if (!bitmap) return null;
  try {
    return deps.readback(bitmap, longEdge);
  } finally {
    bitmap.close();
  }
}
