import { beforeEach, describe, expect, it } from "vitest";
import type { FrameSample } from "../src/frame";
import { initRuntime } from "../src/runtime";
import type { SafelightAPI } from "../src/safelight";
import { initStore, sampleOf, store } from "../src/store";
import { fakeStore } from "./support/fake-api";

const sample = (): FrameSample => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });

describe("the session's sampled frame", () => {
  beforeEach(() => {
    initRuntime({ stores: { create: fakeStore } } as unknown as SafelightAPI);
    initStore();
  });

  it("belongs to the photo it was rendered from", () => {
    const frame = { photoId: "a", sample: sample() };
    expect(sampleOf(frame, "a")).toBe(frame.sample);
    expect(sampleOf(frame, "b")).toBeNull();
    expect(sampleOf(frame, null)).toBeNull();
    expect(sampleOf(null, "a")).toBeNull();
  });

  it("is dropped when the target tool turns off, so another photo never samples it", () => {
    const s = store().getState();
    s.setTarget(true);
    s.setFrame({ photoId: "a", sample: sample() });
    expect(store().getState().frame?.photoId).toBe("a");
    s.setTarget(false);
    expect(store().getState().frame).toBeNull();
    s.setTarget(true);
    expect(sampleOf(store().getState().frame, "b")).toBeNull();
  });

  it("is kept while the tool stays on", () => {
    const s = store().getState();
    s.setTarget(true);
    s.setFrame({ photoId: "a", sample: sample() });
    s.setTarget(true);
    expect(store().getState().frame?.photoId).toBe("a");
  });
});
