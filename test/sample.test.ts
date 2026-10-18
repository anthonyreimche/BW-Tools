import { describe, expect, it, vi } from "vitest";
import type { FrameSample } from "../src/frame";
import { KEY } from "../src/params";
import type { DevelopParams, DevelopStoreState } from "../src/safelight";
import { originalBag, renderOriginal, type OriginalDeps } from "../src/sample";

const PARAMS = { exposure: 0 } as unknown as DevelopParams;
const PREVIEW = { exposure: 1 } as unknown as DevelopParams;
const SAMPLE: FrameSample = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

function deps(state: Partial<DevelopStoreState>, bitmap: ImageBitmap | null = { close: vi.fn() } as unknown as ImageBitmap) {
  const render = vi.fn(async () => bitmap);
  const readback = vi.fn(() => SAMPLE);
  const d: OriginalDeps = {
    develop: () => ({ photoId: "p1", params: PARAMS, previewParams: null, paramBag: {}, ...state }) as DevelopStoreState,
    render,
    readback,
  };
  return { d, render, readback, bitmap };
}

describe("originalBag", () => {
  it("bypasses both stages and keeps every other key", () => {
    expect(originalBag({ [KEY.convertOn]: 1, [KEY.toneOn]: 1, "other.stage.x": 3 })).toEqual({
      [KEY.convertOn]: 0,
      [KEY.toneOn]: 0,
      "other.stage.x": 3,
    });
  });
});

describe("renderOriginal", () => {
  it("renders nothing without an open photo", async () => {
    const { d, render } = deps({ photoId: null });
    expect(await renderOriginal(64, d)).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it("renders the preview params with B&W bypassed and closes the bitmap", async () => {
    const { d, render, readback, bitmap } = deps({ previewParams: PREVIEW, paramBag: { [KEY.convertOn]: 1, "x.y": 2 } });
    expect(await renderOriginal(64, d)).toBe(SAMPLE);
    expect(render).toHaveBeenCalledWith("p1", PREVIEW, { [KEY.convertOn]: 0, [KEY.toneOn]: 0, "x.y": 2 });
    expect(readback).toHaveBeenCalledWith(bitmap, 64);
    expect(bitmap!.close).toHaveBeenCalled();
  });

  it("is null when the photo can't render", async () => {
    const { d, readback } = deps({}, null);
    expect(await renderOriginal(64, d)).toBeNull();
    expect(readback).not.toHaveBeenCalled();
  });
});
