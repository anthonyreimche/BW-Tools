// The on-image target tool: drag up over a colour to lighten it in grey, down
// to darken it, through the band sliders that colour belongs to (core HSL's
// picker, for the B&W mix). The colour comes from the photo rendered with
// B&W bypassed, refreshed when the photo or another stage's edit changes.
// Ctrl / ⌘ / Space go click-through so pan and zoom keep working; Esc ends
// the tool, and so do Colour treatment and leaving Develop.

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { EXT_ID, isOn, paramsPatch, readParams } from "./params";
import { api, h } from "./runtime";
import { TARGET_LONG_EDGE, renderOriginal } from "./sample";
import { sampleOf, store } from "./store";
import { MIN_CHROMA, moveDrag, pointToUv, sampleTarget, settleDrag, type Drag } from "./target";

export const FRAME_DELAY_MS = 150;

/** The bag without this extension's keys: when it changes, the original
 *  colours may have; a band drag alone doesn't change them. */
export function foreignSignature(bag: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(bag)
      .filter((k) => !k.startsWith(`${EXT_ID}.`))
      .sort()
      .map((k) => [k, bag[k]]),
  );
}

export function TargetOverlay(): ReactElement | null {
  const { useEffect, useRef, useState } = api().react;
  const dev = api().stores.useDevelopStore;
  const photoId = dev((s) => s.photoId);
  const params = dev((s) => s.params);
  const paramBag = dev((s) => s.paramBag);
  const target = store()((s) => s.target);
  const overlay = api().develop.useDevelopOverlay();
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [passthrough, setPassthrough] = useState(false);
  const [grey, setGrey] = useState(false);
  const on = isOn(paramBag);
  const signature = foreignSignature(paramBag);
  const commit = (label: string) => void dev.getState().commitEdit(label);

  useEffect(() => {
    if (target && !on) store().getState().setTarget(false);
  }, [target, on]);

  useEffect(() => () => store().getState().setTarget(false), []);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderOriginal(TARGET_LONG_EDGE)
        .then((sample) => {
          if (!cancelled) store().getState().setFrame(sample && photoId ? { photoId, sample } : null);
        })
        .catch(() => {
          if (!cancelled) store().getState().setFrame(null);
        });
    }, FRAME_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target, photoId, params, signature]);

  // Turning the tool off mid-drag (Esc, V) drops the overlay and its pointer
  // capture without a pointer-up, so the drag is ended here.
  useEffect(() => {
    if (!target) return;
    return () => settleDrag(drag, commit);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const held = new Set<string>();
    const update = () => setPassthrough(held.has("Control") || held.has("Meta") || held.has(" "));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        store().getState().setTarget(false);
        return;
      }
      held.add(e.key);
      update();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      held.delete(e.key);
      update();
    };
    const onBlur = () => {
      held.clear();
      update();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      setPassthrough(false);
    };
  }, [target]);

  if (!target) return null;

  /** The sampled frame, if it shows the photo that is open now. */
  const openFrame = () => sampleOf(store().getState().frame, dev.getState().photoId);

  /** The pointer's layout-px y in the overlay and its image UV. */
  const locate = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const scale = box.width > 0 ? el.clientWidth / box.width : 1;
    // The full image's rect, not `rect`: zoomed, `rect` is the visible window,
    // and the frame being sampled is the whole photo.
    const imageRect = overlay.imageRect ?? overlay.rect;
    return { y: (clientY - box.top) * scale, uv: pointToUv(clientX, clientY, box, el.clientWidth, imageRect) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const at = locate(e.clientX, e.clientY);
    const sampled = at ? sampleTarget(openFrame(), at.uv) : null;
    if (!at || !sampled || sampled.chroma < MIN_CHROMA) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      start: [...readParams(dev.getState().paramBag).bands],
      at: sampled,
      y: at.y,
      pointerId: e.pointerId,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = locate(e.clientX, e.clientY);
    const write = (bands: number[]) => dev.getState().setDynParams(paramsPatch({ bands }));
    if (moveDrag(drag, e.buttons, at ? at.y : null, { write, commit })) return;
    const sampled = at ? sampleTarget(openFrame(), at.uv) : null;
    setGrey(sampled !== null && sampled.chroma < MIN_CHROMA);
  };

  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (e.currentTarget.hasPointerCapture(d.pointerId)) e.currentTarget.releasePointerCapture(d.pointerId);
    settleDrag(drag, commit);
  };

  const style: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: passthrough ? "none" : "auto",
    cursor: api().cursors.resolve(grey ? "not-allowed" : "pick"),
  };
  return h("div", { ref, style, onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end });
}
