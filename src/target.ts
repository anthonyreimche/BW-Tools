// The target tool, the canvas's pick-drag tool while it is on: which original
// colour is under the press, and how a vertical drag moves the band sliders,
// spread by the same band weights the shader blends with (core HSL's picker
// does the same).

import { patchLinear, type FrameSample } from "./frame";
import { bandWeight, hueChroma, type HueChroma } from "./model";
import type { CanvasPoint, OverlayRect, PickDragTool } from "./safelight";
import type { Captured } from "./sample";

/** Slider units per layout px, core HSL's default picker sensitivity. */
export const DRAG_SENSITIVITY = 0.5;
/** Below this the colour is too grey for the mix to act on. */
export const MIN_CHROMA = 0.05;

export function sampleTarget(frame: FrameSample | null, uv: { x: number; y: number } | null): HueChroma | null {
  if (!frame || !uv) return null;
  const rgb = patchLinear(frame, uv.x, uv.y);
  return rgb ? hueChroma(rgb) : null;
}

/** The band sliders after dragging `dy` layout px (down positive) from
 *  `start` over a colour: up lightens it, down darkens it. */
export function dragBands(start: readonly number[], at: HueChroma, dy: number): number[] {
  if (at.chroma < MIN_CHROMA) return [...start];
  return start.map((b, i) =>
    Math.max(-100, Math.min(100, b - dy * DRAG_SENSITIVITY * bandWeight(at.hue, i) * at.chroma)),
  );
}

export const LABEL_TARGET = "Black & White target";

/** The original colour under a press, and the layout px one canvas px spans,
 *  which keeps DRAG_SENSITIVITY per layout px at any render resolution. */
export interface TargetSample {
  at: HueChroma;
  scale: number;
}

/** The colour under canvas point `point` in a capture of the live view;
 *  `rect` is where the canvas shows on screen. Null off the canvas, without a
 *  capture, or over a colour too grey for the mix to act on. */
export function readPress(captured: Captured | null, point: CanvasPoint, rect: OverlayRect | null): TargetSample | null {
  if (!captured || captured.width <= 0 || captured.height <= 0) return null;
  const at = sampleTarget(captured.sample, { x: point.x / captured.width, y: point.y / captured.height });
  if (!at || at.chroma < MIN_CHROMA) return null;
  return { at, scale: rect && rect.h > 0 ? rect.h / captured.height : 1 };
}

export interface TargetIo {
  bands(): number[];
  sample(point: CanvasPoint): Promise<TargetSample | null>;
  write(bands: number[]): void;
  commit(label: string): void;
}

/** A press: the bands when it began, its canvas y, the colour once it has been
 *  read, and the latest y. */
interface Press {
  start: number[];
  y: number;
  read: TargetSample | null;
  last: number | null;
  moved: boolean;
  released: boolean;
}

/** The pick-drag tool. The original colour is read after the press, so a drag
 *  waits for it: moves made meanwhile land when it does, and a release made
 *  meanwhile commits then. `end` releases a press the tool is put down during,
 *  where no `onUp` arrives. */
export function targetTool(io: TargetIo): PickDragTool & { end(): void } {
  let press: Press | null = null;
  /** The newest press, released or not: a read that lands after a later
   *  press began would drag from stale bands over that press's. */
  let latest: Press | null = null;

  const apply = (p: Press) => {
    if (!p.read || p.last === null) return;
    p.moved = true;
    io.write(dragBands(p.start, p.read.at, (p.last - p.y) * p.read.scale));
  };
  const settle = (p: Press) => {
    if (p.moved) io.commit(LABEL_TARGET);
  };
  const release = () => {
    const p = press;
    if (!p) return;
    press = null;
    p.released = true;
    if (p.read) settle(p);
  };

  return {
    onDown(_shown, point) {
      const p: Press = { start: io.bands(), y: point.y, read: null, last: null, moved: false, released: false };
      press = p;
      latest = p;
      io.sample(point)
        .catch(() => null)
        .then((read) => {
          if (latest !== p) return;
          if (!read) {
            if (press === p) press = null;
            return;
          }
          p.read = read;
          apply(p);
          if (p.released) settle(p);
        });
    },
    onMove(point) {
      if (!press) return;
      press.last = point.y;
      apply(press);
    },
    onUp: release,
    end: release,
  };
}
