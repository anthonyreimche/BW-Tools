import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colourHint, pressAuto, weightsReadout } from "../src/Panel";
import { DEFAULTS } from "../src/params";
import { initRuntime } from "../src/runtime";
import type { SafelightAPI } from "../src/safelight";
import { initStore, store, type AutoStatus } from "../src/store";
import { foreignSignature } from "../src/TargetOverlay";
import { fakeStore } from "./support/fake-api";

describe("panel text", () => {
  it("names the live shortcut in Colour, or just the switch when it's unbound", () => {
    expect(colourHint("V")).toBe("Press V or choose Black & White.");
    expect(colourHint("Shift+B")).toBe("Press Shift+B or choose Black & White.");
    expect(colourHint("")).toBe("Choose Black & White to convert this photo.");
  });

  it("shows the Custom response's normalised weights", () => {
    expect(weightsReadout({ ...DEFAULTS, response: 6, mixR: 100, mixG: 60, mixB: 40 })).toBe(
      "Normalised: R 0.50 · G 0.30 · B 0.20",
    );
  });
});

describe("foreignSignature", () => {
  it("ignores this extension's keys and key order", () => {
    expect(foreignSignature({ "black-and-white.convert.band0": 5, "x.stage.a": 1, "y.stage.b": 2 })).toBe(
      foreignSignature({ "y.stage.b": 2, "black-and-white.tone.toner": 3, "x.stage.a": 1 }),
    );
  });

  it("changes when another stage's value changes", () => {
    expect(foreignSignature({ "x.stage.a": 1 })).not.toBe(foreignSignature({ "x.stage.a": 2 }));
  });
});

describe("pressAuto", () => {
  const status = (): AutoStatus => store().getState().auto;

  beforeEach(() => {
    vi.useFakeTimers();
    initRuntime({ stores: { create: fakeStore } } as unknown as SafelightAPI);
    initStore();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is busy while it runs and idle after a run that worked", async () => {
    let finish!: (ok: boolean) => void;
    const running = pressAuto(() => new Promise<boolean>((resolve) => (finish = resolve)));
    expect(status()).toBe("busy");
    finish(true);
    await running;
    expect(status()).toBe("idle");
  });

  it("shows the failure for a moment when there was nothing to read, then goes idle", async () => {
    await pressAuto(async () => false);
    expect(status()).toBe("failed");
    await vi.advanceTimersByTimeAsync(2000);
    expect(status()).toBe("idle");
  });

  // A commit that can't reach storage rejects runAuto. Busy used to stay set,
  // and with it Auto stayed disabled until the app restarted.
  it("clears busy and warns when the run rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const boom = new Error("disk full");
    await pressAuto(() => Promise.reject(boom));
    expect(status()).not.toBe("busy");
    expect(status()).toBe("failed");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[black-and-white\] /);
    expect(warn.mock.calls[0]).toContain(boom);
    await vi.advanceTimersByTimeAsync(2000);
    expect(status()).toBe("idle");
  });
});
