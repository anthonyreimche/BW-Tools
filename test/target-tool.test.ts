// The target tool runs as the canvas's pick-drag tool: core hands it the press
// and the drag, so it takes turns with every other picker and on-image tool.
// The colour it drags by is the original under the press (the photo with B&W
// bypassed), never the grey the view shows there.

import { describe, expect, it, vi } from "vitest";
import type { FrameSample } from "../src/frame";
import { KEY } from "../src/params";
import type { CanvasPoint, DevelopParams, DevelopStoreState } from "../src/safelight";
import { captureOriginal, type CaptureDeps } from "../src/sample";
import { LABEL_TARGET, dragBands, readPress, targetTool, type TargetIo, type TargetSample } from "../src/target";

const ZERO = [0, 0, 0, 0, 0, 0, 0, 0];
const RED = { hue: 0, sat: 1, chroma: 1 };
const SHOWN_GREY = [0.4, 0.4, 0.4] as const;

function rig(read: Promise<TargetSample | null> | (() => Promise<TargetSample | null>)) {
  const io = {
    bands: () => [...ZERO],
    sample: vi.fn<(point: CanvasPoint) => Promise<TargetSample | null>>(typeof read === "function" ? read : () => read),
    write: vi.fn<(bands: number[]) => void>(),
    commit: vi.fn<(label: string) => void>(),
  } satisfies TargetIo;
  return { io, tool: targetTool(io) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("targetTool", () => {
  it("drags by the original colour under the press, not the grey the view shows", async () => {
    const { io, tool } = rig(Promise.resolve({ at: RED, scale: 0.5 }));
    tool.onDown?.(SHOWN_GREY, { x: 40, y: 100 });
    expect(io.sample).toHaveBeenCalledWith({ x: 40, y: 100 });
    await settle();
    tool.onMove?.({ x: 40, y: 60 });
    // 40 canvas px at 0.5 layout px each: 20 layout px up.
    expect(io.write).toHaveBeenLastCalledWith(dragBands(ZERO, RED, -20));
  });

  it("carries a move made before the original colour is read once it arrives", async () => {
    let answer!: (s: TargetSample) => void;
    const { io, tool } = rig(new Promise<TargetSample | null>((resolve) => (answer = resolve)));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    tool.onMove?.({ x: 0, y: 80 });
    expect(io.write).not.toHaveBeenCalled();
    answer({ at: RED, scale: 1 });
    await settle();
    expect(io.write).toHaveBeenLastCalledWith(dragBands(ZERO, RED, -20));
  });

  it("commits a drag once, on release", async () => {
    const { io, tool } = rig(Promise.resolve({ at: RED, scale: 1 }));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    await settle();
    tool.onMove?.({ x: 0, y: 90 });
    tool.onUp?.();
    tool.onUp?.();
    expect(io.commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
  });

  it("commits a drag released before the colour was read, with its moves, once it is", async () => {
    let answer!: (s: TargetSample) => void;
    const { io, tool } = rig(new Promise<TargetSample | null>((resolve) => (answer = resolve)));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    tool.onMove?.({ x: 0, y: 70 });
    tool.onUp?.();
    expect(io.commit).not.toHaveBeenCalled();
    answer({ at: RED, scale: 1 });
    await settle();
    expect(io.write).toHaveBeenLastCalledWith(dragBands(ZERO, RED, -30));
    expect(io.commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
  });

  it("leaves a press that never moved out of the history", async () => {
    const { io, tool } = rig(Promise.resolve({ at: RED, scale: 1 }));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    await settle();
    tool.onUp?.();
    expect(io.commit).not.toHaveBeenCalled();
  });

  it("moves nothing over a colour too grey to act on", async () => {
    const { io, tool } = rig(Promise.resolve(null));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    await settle();
    tool.onMove?.({ x: 0, y: 0 });
    tool.onUp?.();
    expect(io.write).not.toHaveBeenCalled();
    expect(io.commit).not.toHaveBeenCalled();
  });

  it("ends a held press when the tool is put down mid-drag, where no release arrives", async () => {
    const { io, tool } = rig(Promise.resolve({ at: RED, scale: 1 }));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    await settle();
    tool.onMove?.({ x: 0, y: 90 });
    tool.end();
    tool.onMove?.({ x: 0, y: 0 });
    expect(io.commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
    expect(io.write).toHaveBeenCalledTimes(1);
  });
});

describe("readPress", () => {
  // A 40×20 frame: red on the left half, blue on the right.
  const data = new Uint8ClampedArray(40 * 20 * 4);
  for (let i = 0; i < 800; i++) data.set(i % 40 < 20 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
  const frame: FrameSample = { data, width: 40, height: 20 };

  it("reads the frame at the canvas point, through the canvas's size", () => {
    const right = readPress({ sample: frame, width: 400, height: 200 }, { x: 390, y: 100 }, { x: 0, y: 0, w: 200, h: 100 });
    expect(right?.at.hue).toBeCloseTo(240);
    expect(right?.scale).toBe(0.5);
    const left = readPress({ sample: frame, width: 400, height: 200 }, { x: 10, y: 100 }, null);
    expect(left?.at.hue).toBeCloseTo(0);
    expect(left?.scale).toBe(1);
  });

  it("is null off the canvas, over a grey, or without a frame", () => {
    const grey: FrameSample = { data: new Uint8ClampedArray(16).fill(128), width: 2, height: 2 };
    expect(readPress({ sample: frame, width: 400, height: 200 }, { x: 500, y: 100 }, null)).toBeNull();
    expect(readPress({ sample: grey, width: 400, height: 200 }, { x: 10, y: 10 }, null)).toBeNull();
    expect(readPress(null, { x: 10, y: 10 }, null)).toBeNull();
  });
});

describe("captureOriginal", () => {
  const PARAMS = { exposure: 0 } as unknown as DevelopParams;
  const PREVIEW = { exposure: 1 } as unknown as DevelopParams;
  const SAMPLE: FrameSample = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

  function deps(state: Partial<DevelopStoreState>) {
    const bitmap = { width: 800, height: 600, close: vi.fn() } as unknown as ImageBitmap;
    const capture = vi.fn(async () => bitmap);
    const readback = vi.fn(() => SAMPLE);
    const d: CaptureDeps = {
      develop: () => ({ photoId: "p1", params: PARAMS, previewParams: null, paramBag: {}, ...state }) as DevelopStoreState,
      capture,
      readback,
    };
    return { d, capture, readback, bitmap };
  }

  it("captures the live view with B&W bypassed, at the canvas's size, and closes the bitmap", async () => {
    const { d, capture, readback, bitmap } = deps({ previewParams: PREVIEW, paramBag: { [KEY.convertOn]: 1 } });
    expect(await captureOriginal(256, d)).toEqual({ sample: SAMPLE, width: 800, height: 600 });
    expect(capture).toHaveBeenCalledWith(PREVIEW, { [KEY.convertOn]: 0, [KEY.toneOn]: 0 });
    expect(readback).toHaveBeenCalledWith(bitmap, 256);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("captures nothing without an open photo", async () => {
    const { d, capture } = deps({ photoId: null });
    expect(await captureOriginal(256, d)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("targetTool across presses", () => {
  it("drops a colour read for an earlier press once a later press has begun", async () => {
    const answers: ((s: TargetSample) => void)[] = [];
    const { io, tool } = rig(() => new Promise<TargetSample | null>((resolve) => answers.push(resolve)));
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    tool.onMove?.({ x: 0, y: 50 });
    tool.onUp?.();
    tool.onDown?.(SHOWN_GREY, { x: 0, y: 100 });
    answers[1]({ at: RED, scale: 1 });
    await settle();
    tool.onMove?.({ x: 0, y: 90 });
    answers[0]({ at: RED, scale: 1 });
    await settle();
    tool.onUp?.();
    expect(io.write).toHaveBeenCalledExactlyOnceWith(dragBands(ZERO, RED, -10));
    expect(io.commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
  });
});
