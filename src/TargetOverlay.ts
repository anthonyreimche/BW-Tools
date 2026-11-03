// The on-image target tool: drag up over a colour to lighten it in grey, down
// to darken it, through the band sliders that colour belongs to (core HSL's
// picker, for the B&W mix). While it is on it holds the canvas's pick-drag
// tool, so core routes the press to it, takes turns with every other picker
// and on-image tool, pans on Ctrl / ⌘ / Space and lets it go on Escape. The
// colour comes from a capture of the live view with B&W bypassed. Colour
// treatment and leaving Develop end the tool too; nothing is drawn.

import { isOn, paramsPatch, readParams } from "./params";
import { api } from "./runtime";
import type { OverlayRect } from "./safelight";
import { TARGET_LONG_EDGE, captureOriginal } from "./sample";
import { store } from "./store";
import { readPress, targetTool, type TargetIo } from "./target";

/** Where the canvas shows on screen, kept by TargetOverlay for the drag's
 *  scale. */
let shownRect: OverlayRect | null = null;

function liveTargetIo(): TargetIo {
  const dev = api().stores.useDevelopStore;
  return {
    bands: () => [...readParams(dev.getState().paramBag).bands],
    sample: async (point) => readPress(await captureOriginal(TARGET_LONG_EDGE), point, shownRect),
    write: (bands) => dev.getState().setDynParams(paramsPatch({ bands })),
    commit: (label) => void dev.getState().commitEdit(label),
  };
}

/** Hands the canvas the target tool whenever Target turns on, and takes it
 *  back when it turns off; returns the unsubscribe. */
export function holdTarget(io: TargetIo = liveTargetIo()): () => void {
  const tool = targetTool(io);
  return store().subscribe((s, prev) => {
    if (s.target === prev.target) return;
    if (s.target) {
      api().develop.setPickDrag(tool);
    } else {
      tool.end();
      api().develop.setPickDrag(null);
    }
  });
}

/** Keeps Target in step with the canvas: off once core lets the tool go (Esc,
 *  another extension's picker), in Colour, and on leaving Develop. */
export function TargetOverlay(): null {
  const { useEffect } = api().react;
  const target = store()((s) => s.target);
  const on = isOn(api().stores.useDevelopStore((s) => s.paramBag));
  const held = api().develop.usePickDragHeld();
  const { rect } = api().develop.useDevelopOverlay();

  useEffect(() => {
    shownRect = rect;
  }, [rect]);

  useEffect(() => {
    if (target && (!on || !held)) store().getState().setTarget(false);
  }, [target, on, held]);

  useEffect(() => () => store().getState().setTarget(false), []);

  return null;
}
