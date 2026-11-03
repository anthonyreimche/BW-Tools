// Target holds the canvas's pick-drag tool instead of laying a pointer-catching
// layer over the canvas: core then routes a press to whichever tool holds the
// canvas (White Balance's picker, HSL's target, Crop, Heal, Masking), and gives
// Target its Escape and its Ctrl / ⌘ / Space pan.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY } from "../src/params";
import { initRuntime } from "../src/runtime";
import type { PickDragTool, SafelightAPI } from "../src/safelight";
import { initStore, store } from "../src/store";
import { TargetOverlay, holdTarget } from "../src/TargetOverlay";
import type { TargetIo } from "../src/target";
import { fakeDevelop, fakeStore } from "./support/fake-api";

function host(held: () => boolean = () => true) {
  const picks: (PickDragTool | null)[] = [];
  const cleanups: (() => void)[] = [];
  const dev = fakeDevelop();
  dev.store.setState({ photoId: "p", paramBag: { [KEY.convertOn]: 1, [KEY.toneOn]: 1 } });
  const api = {
    react: {
      useEffect: (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      },
    },
    stores: { create: fakeStore, useDevelopStore: dev.store },
    develop: {
      setPickDrag: (tool: PickDragTool | null) => void picks.push(tool),
      usePickDragHeld: held,
      useDevelopOverlay: () => ({ rect: { x: 0, y: 0, w: 400, h: 300 }, nonce: 0 }),
    },
  } as unknown as SafelightAPI;
  initRuntime(api);
  initStore();
  return { picks, cleanups };
}

const io = (): TargetIo => ({
  bands: () => [0, 0, 0, 0, 0, 0, 0, 0],
  sample: async () => ({ at: { hue: 0, sat: 1, chroma: 1 }, scale: 1 }),
  write: vi.fn(),
  commit: vi.fn(),
});

describe("Target on the canvas", () => {
  let release: (() => void) | null = null;
  beforeEach(() => void (release = null));
  afterEach(() => release?.());

  it("holds the canvas's pick-drag tool while it is on, and lets it go when it is off", () => {
    const { picks } = host();
    release = holdTarget(io());
    store().getState().setTarget(true);
    expect(picks[picks.length - 1]?.onDown).toBeTypeOf("function");
    store().getState().setTarget(false);
    expect(picks[picks.length - 1]).toBeNull();
  });

  it("draws nothing over the canvas", () => {
    host();
    release = holdTarget(io());
    store().getState().setTarget(true);
    expect(TargetOverlay()).toBeNull();
    expect(store().getState().target).toBe(true);
  });

  it("turns off when another tool takes the pick-drag, or Escape drops it", () => {
    let held = true;
    host(() => held);
    release = holdTarget(io());
    store().getState().setTarget(true);
    TargetOverlay();
    held = false;
    TargetOverlay();
    expect(store().getState().target).toBe(false);
  });

  it("ends a drag held when it turns off, committing what it moved", async () => {
    const { picks } = host();
    const target = io();
    release = holdTarget(target);
    store().getState().setTarget(true);
    const tool = picks[picks.length - 1];
    tool?.onDown?.([0.4, 0.4, 0.4], { x: 0, y: 100 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    tool?.onMove?.({ x: 0, y: 80 });
    store().getState().setTarget(false);
    expect(target.commit).toHaveBeenCalledTimes(1);
  });
});
