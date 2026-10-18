import { describe, expect, it, vi } from "vitest";
import type { FrameSample } from "../src/frame";
import { LABEL_TARGET, dragBands, moveDrag, pointToUv, sampleTarget, settleDrag, type Drag, type DragSlot } from "../src/target";

const ZERO = [0, 0, 0, 0, 0, 0, 0, 0];

describe("pointToUv", () => {
  const box = { left: 100, top: 50, width: 500, height: 400 };
  it("maps a client point through the image rect, undoing the UI scale", () => {
    // clientWidth 1000 over a 500-px box: the body is zoomed out 2×.
    const uv = pointToUv(100 + 150, 50 + 100, box, 1000, { x: 100, y: 0, w: 400, h: 400 });
    expect(uv).toEqual({ x: (300 - 100) / 400, y: 200 / 400 });
  });
  it("maps through a full-image rect that extends past the frame (zoomed)", () => {
    // 4× zoom: the frame shows a 500×400 window of a 2000×1600 image, so the
    // frame's centre is not the image's centre. The window rect would say 0.5.
    const imageRect = { x: -500, y: -400, w: 2000, h: 1600 };
    expect(pointToUv(100 + 250, 50 + 200, box, 500, imageRect)).toEqual({ x: 0.375, y: 0.375 });
    expect(pointToUv(100 + 250, 50 + 200, box, 500, { x: 0, y: 0, w: 500, h: 400 })).toEqual({ x: 0.5, y: 0.5 });
  });
  it("is null outside the image or without a rect", () => {
    expect(pointToUv(100, 50, box, 500, { x: 10, y: 10, w: 100, h: 100 })).toBeNull();
    expect(pointToUv(200, 200, box, 500, null)).toBeNull();
  });
});

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

describe("a drag held across the tool turning off", () => {
  const red = { hue: 0, sat: 1, chroma: 1 };
  const held = (moved = false): DragSlot => ({
    current: { start: [...ZERO], at: red, y: 100, pointerId: 1, moved } satisfies Drag,
  });
  const io = () => ({ write: vi.fn<(bands: number[]) => void>(), commit: vi.fn<(label: string) => void>() });

  it("moves the bands with the pointer while a button is down", () => {
    const slot = held();
    const out = io();
    expect(moveDrag(slot, 1, 80, out)).toBe(true);
    expect(out.write).toHaveBeenCalledWith(dragBands(ZERO, red, -20));
    expect(slot.current?.moved).toBe(true);
    expect(out.commit).not.toHaveBeenCalled();
  });

  it("isn't a drag move when none is held", () => {
    const slot: DragSlot = { current: null };
    const out = io();
    expect(moveDrag(slot, 1, 80, out)).toBe(false);
    expect(out.write).not.toHaveBeenCalled();
  });

  it("commits the bands a drag moved, once, as one step, when it is settled", () => {
    const slot = held(true);
    const commit = vi.fn<(label: string) => void>();
    settleDrag(slot, commit);
    settleDrag(slot, commit);
    expect(commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
    expect(LABEL_TARGET).toBe("Black & White target");
    expect(slot.current).toBeNull();
  });

  it("drops a drag that never moved without a history step", () => {
    const slot = held(false);
    const commit = vi.fn<(label: string) => void>();
    settleDrag(slot, commit);
    expect(commit).not.toHaveBeenCalled();
    expect(slot.current).toBeNull();
  });

  // Esc or V mid-drag turns the tool off, pointer capture goes with the
  // overlay, and no pointer-up ever arrives. Back on, a hover must not carry on
  // the old drag, and the next click must not commit it.
  it("can't be continued by a hover once the tool has been off and on again", () => {
    const slot = held();
    const out = io();
    moveDrag(slot, 1, 60, out);
    settleDrag(slot, out.commit);
    expect(out.commit).toHaveBeenCalledTimes(1);
    out.write.mockClear();
    expect(moveDrag(slot, 0, 10, out)).toBe(false);
    settleDrag(slot, out.commit);
    expect(out.write).not.toHaveBeenCalled();
    expect(out.commit).toHaveBeenCalledTimes(1);
  });

  it("ends a held drag whose button is no longer down, instead of following the pointer", () => {
    const slot = held();
    const out = io();
    moveDrag(slot, 1, 60, out);
    out.write.mockClear();
    expect(moveDrag(slot, 0, 10, out)).toBe(true);
    expect(out.write).not.toHaveBeenCalled();
    expect(out.commit).toHaveBeenCalledExactlyOnceWith(LABEL_TARGET);
    expect(slot.current).toBeNull();
  });

  it("ignores a move that has no position without ending the drag", () => {
    const slot = held();
    const out = io();
    expect(moveDrag(slot, 1, null, out)).toBe(true);
    expect(out.write).not.toHaveBeenCalled();
    expect(slot.current).not.toBeNull();
  });
});
