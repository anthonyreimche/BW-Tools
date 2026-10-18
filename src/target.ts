// The target tool's maths: where the pointer is in the image, which colour is
// under it, and how a vertical drag moves the band sliders, spread by the same
// band weights the shader blends with (core HSL's picker does the same).

import { patchLinear, type FrameSample } from "./frame";
import { bandWeight, hueChroma, type HueChroma } from "./model";
import type { OverlayRect } from "./safelight";

/** Slider units per layout px, core HSL's default picker sensitivity. */
export const DRAG_SENSITIVITY = 0.5;
/** Below this the colour is too grey for the mix to act on. */
export const MIN_CHROMA = 0.05;

export interface ClientBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Client point → image UV through the rect the full image occupies (core's
 *  `imageRect`, which extends past the frame when zoomed; the visible-window
 *  `rect` would give window-relative UVs). `clientWidth / box.width` is the
 *  interface scale (the body zoom), so a zoomed UI still lands on the pixel
 *  under the pointer. Null outside the image. */
export function pointToUv(
  clientX: number,
  clientY: number,
  box: ClientBox,
  clientWidth: number,
  rect: OverlayRect | null,
): { x: number; y: number } | null {
  if (!rect || box.width <= 0 || box.height <= 0 || rect.w <= 0 || rect.h <= 0) return null;
  const scale = clientWidth / box.width;
  const x = ((clientX - box.left) * scale - rect.x) / rect.w;
  const y = ((clientY - box.top) * scale - rect.y) / rect.h;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

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

/** A drag in progress: the bands when it began, the colour it grabbed and the
 *  pointer's layout-px y there. */
export interface Drag {
  start: number[];
  at: HueChroma;
  y: number;
  pointerId: number;
  moved: boolean;
}

/** Where the overlay keeps its drag (a React ref). */
export interface DragSlot {
  current: Drag | null;
}

export interface DragIo {
  write(bands: number[]): void;
  commit(label: string): void;
}

/** Ends the held drag, committing the bands it moved as one undo step. Also the
 *  way out when the tool is turned off mid-drag: no pointer-up arrives then. */
export function settleDrag(slot: DragSlot, commit: (label: string) => void): void {
  const d = slot.current;
  if (!d) return;
  slot.current = null;
  if (d.moved) commit(LABEL_TARGET);
}

/** Carries a pointer move into the held drag; false when none is held. A move
 *  with no button down means the pointer-up was lost, so the drag ends there
 *  instead of following a hover. `y` is null when the pointer can't be placed. */
export function moveDrag(slot: DragSlot, buttons: number, y: number | null, io: DragIo): boolean {
  const d = slot.current;
  if (!d) return false;
  if (buttons === 0) {
    settleDrag(slot, io.commit);
    return true;
  }
  if (y === null) return true;
  d.moved = true;
  io.write(dragBands(d.start, d.at, y - d.y));
  return true;
}
