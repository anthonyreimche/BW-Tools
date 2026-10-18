import { describe, expect, it, vi, type Mock } from "vitest";
import {
  LABEL_BW,
  LABEL_COLOUR,
  convertPhotos,
  developActive,
  menuLabel,
  runAuto,
  toggleTreatment,
  type ConvertDeps,
} from "../src/actions";
import type { FrameSample } from "../src/frame";
import { CONVERT_ID, KEY, isOn, readParams, treatmentPatch } from "../src/params";
import { fakeDevelop } from "./support/fake-api";

describe("developActive", () => {
  it("is true in the Develop module", () => {
    expect(developActive("develop", "")).toBe(true);
  });

  it("is false in the Library", () => {
    expect(developActive("library", "")).toBe(false);
    expect(developActive("library", "?detached=library")).toBe(false);
  });

  // A popped-out Develop window keeps its own active module, which is not
  // necessarily "develop", and core hands it extension key actions regardless.
  it("is true in a window popped out of Develop", () => {
    expect(developActive("library", "?detached=develop")).toBe(true);
    expect(developActive("library", "?theme=dark&detached=develop")).toBe(true);
  });
});

describe("toggleTreatment", () => {
  it("does nothing outside Develop or without a photo", () => {
    const dev = fakeDevelop();
    toggleTreatment({ develop: dev.store, inDevelop: () => false });
    toggleTreatment({ develop: dev.store, inDevelop: () => true });
    expect(dev.commits).toEqual([]);
  });

  it("flips both flags and commits one step each way", async () => {
    const dev = fakeDevelop(new Map([["p1", {}]]));
    await dev.store.getState().loadEdit("p1");
    const deps = { develop: dev.store, inDevelop: () => true };
    toggleTreatment(deps);
    expect(dev.store.getState().paramBag).toMatchObject(treatmentPatch(true));
    toggleTreatment(deps);
    expect(dev.store.getState().paramBag).toMatchObject(treatmentPatch(false));
    expect(dev.commits.map((c) => c.label)).toEqual([LABEL_BW, LABEL_COLOUR]);
  });
});

describe("convertPhotos", () => {
  function deps(
    dev: ReturnType<typeof fakeDevelop>,
    restoreId: string | null = "open",
    over: Partial<ConvertDeps> = {},
  ): ConvertDeps & { warn: Mock<(message: string) => void> } {
    return {
      develop: dev.store,
      asShot: (id) => (id === "open" ? 5000 : 6500),
      restoreId,
      inDevelop: () => false,
      yieldToUi: async () => undefined,
      ...over,
      warn: vi.fn<(message: string) => void>(),
    };
  }

  /** The develop store with a loadEdit that waits at `gate` and then calls the
   *  fake's own, so a test can hold a run on its first photo. */
  function gated(dev: ReturnType<typeof fakeDevelop>) {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const load = dev.store.getState().loadEdit;
    dev.store.setState({
      loadEdit: async (id, asShot) => {
        await gate;
        await load(id, asShot);
      },
    });
    return open;
  }

  it("converts the photos not yet in the treatment, skips the rest, and reopens the open photo", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", treatmentPatch(true)], ["open", { "x.y": 1 }]]));
    const result = await convertPhotos(["a", "b"], true, deps(dev));
    expect(result).toEqual({ converted: ["a"], failed: [] });
    expect(isOn(dev.saved.get("a")!)).toBe(true);
    expect(dev.commits).toEqual([{ photoId: "a", label: LABEL_BW }]);
    expect(dev.loads).toEqual([["a", 6500], ["b", 6500], ["open", 5000]]);
    expect(dev.store.getState().photoId).toBe("open");
  });

  it("converts back to Colour", async () => {
    const dev = fakeDevelop(new Map([["a", treatmentPatch(true)]]));
    await convertPhotos(["a"], false, deps(dev, null));
    expect(dev.saved.get("a")).toMatchObject({ [KEY.convertOn]: 0, [KEY.toneOn]: 0 });
    expect(dev.commits.map((c) => c.label)).toEqual([LABEL_COLOUR]);
  });

  it("keeps going past a photo that fails, warns once, and still reopens", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["c", {}]]), new Set(["photo-b"]));
    const d = deps(dev);
    const result = await convertPhotos(["a", "photo-b", "c"], true, d);
    expect(result).toEqual({ converted: ["a", "c"], failed: ["photo-b"] });
    expect(d.warn).toHaveBeenCalledTimes(1);
    expect(d.warn.mock.calls[0][0]).toContain("photo-b");
    expect(dev.loads[dev.loads.length - 1]).toEqual(["open", 5000]);
  });

  it("runs one conversion at a time: a second call does nothing, and the first completes", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", {}], ["open", {}]]));
    const release = gated(dev);
    const first = convertPhotos(["a"], true, deps(dev));
    const d2 = deps(dev);
    expect(await convertPhotos(["b"], true, d2)).toEqual({ converted: [], failed: [] });
    expect(d2.warn).toHaveBeenCalledExactlyOnceWith("[black-and-white] A conversion is already running.");
    expect(dev.loads).toEqual([]);
    release();
    expect(await first).toEqual({ converted: ["a"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "open"]);
    expect(dev.commits).toEqual([{ photoId: "a", label: LABEL_BW }]);
  });

  it("frees the run slot when a run throws", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["open", {}]]));
    const boom = deps(dev, "open", { yieldToUi: async () => Promise.reject(new Error("ui gone")) });
    await expect(convertPhotos(["a"], true, boom)).rejects.toThrow("ui gone");
    const later = deps(dev);
    expect(await convertPhotos(["a"], false, later)).toEqual({ converted: ["a"], failed: [] });
    expect(later.warn).not.toHaveBeenCalled();
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "open", "a", "open"]);
  });

  it("stops without restoring when another photo takes the store between photos", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", {}], ["foreign", {}], ["open", {}]]));
    let first = true;
    const d = deps(dev, "open", {
      yieldToUi: async () => {
        if (!first) return;
        first = false;
        await dev.store.getState().loadEdit("foreign");
      },
    });
    expect(await convertPhotos(["a", "b"], true, d)).toEqual({ converted: ["a"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "foreign"]);
    expect(dev.commits).toEqual([{ photoId: "a", label: LABEL_BW }]);
    expect(dev.store.getState().photoId).toBe("foreign");
  });

  it("doesn't restore over a photo opened after the last one", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["foreign", {}], ["open", {}]]));
    const d = deps(dev, "open", { yieldToUi: async () => dev.store.getState().loadEdit("foreign") });
    expect(await convertPhotos(["a"], true, d)).toEqual({ converted: ["a"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "foreign"]);
    expect(dev.store.getState().photoId).toBe("foreign");
  });

  it("stops without restoring when a load leaves a different photo in the store", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", {}], ["c", {}], ["open", {}]]));
    const load = dev.store.getState().loadEdit;
    dev.store.setState({
      loadEdit: async (id, asShot) => {
        await load(id, asShot);
        if (id === "b") dev.store.setState({ photoId: "elsewhere" });
      },
    });
    expect(await convertPhotos(["a", "b", "c"], true, deps(dev))).toEqual({ converted: ["a"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "b"]);
    expect(dev.commits).toEqual([{ photoId: "a", label: LABEL_BW }]);
    expect(dev.store.getState().photoId).toBe("elsewhere");
  });

  it("stops before the next photo when the user enters Develop, and still restores", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", {}], ["open", {}]]));
    let inDevelop = false;
    const d = deps(dev, "open", {
      inDevelop: () => inDevelop,
      yieldToUi: async () => {
        inDevelop = true;
      },
    });
    expect(await convertPhotos(["a", "b"], true, d)).toEqual({ converted: ["a"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "open"]);
    expect(dev.store.getState().photoId).toBe("open");
  });

  // Grid menu items also show on surfaces inside Develop (a filmstrip), so a
  // run started there must not mistake "Develop is active" for "the user
  // arrived".
  it("converts every photo and restores when it starts inside Develop", async () => {
    const dev = fakeDevelop(new Map([["a", {}], ["b", {}], ["open", {}]]));
    const d = deps(dev, "open", { inDevelop: () => true });
    expect(await convertPhotos(["a", "b"], true, d)).toEqual({ converted: ["a", "b"], failed: [] });
    expect(dev.loads.map(([id]) => id)).toEqual(["a", "b", "open"]);
    expect(dev.store.getState().photoId).toBe("open");
  });

  it("labels a multi-selection with its count", () => {
    expect(menuLabel("Convert to Black & White")(["a"])).toBe("Convert to Black & White");
    expect(menuLabel("Convert to Black & White")(["a", "b", "c"])).toBe("Convert to Black & White (3)");
  });
});

describe("runAuto", () => {
  function twoColourFrame(): FrameSample {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 256; i++) data.set(i % 16 < 8 ? [186, 63, 63, 255] : [63, 118, 63, 255], i * 4);
    return { data, width: 16, height: 16 };
  }

  it("writes the bands and commits one step", async () => {
    const dev = fakeDevelop(new Map([["p", treatmentPatch(true)]]));
    await dev.store.getState().loadEdit("p");
    const frame = twoColourFrame();
    expect(await runAuto({ develop: dev.store, render: async () => frame })).toBe(true);
    expect(dev.commits.map((c) => c.label)).toEqual(["Black & White Auto"]);
    expect(Object.keys(dev.store.getState().paramBag).filter((k) => k.startsWith(`${CONVERT_ID}.band`)).length).toBe(8);
    expect(readParams(dev.store.getState().paramBag).bands.some((b) => b !== 0)).toBe(true);
  });

  it("reports failure when the photo can't be read", async () => {
    const dev = fakeDevelop(new Map([["p", {}]]));
    await dev.store.getState().loadEdit("p");
    const before = dev.store.getState().paramBag;
    const render = vi.fn<() => Promise<FrameSample | null>>();
    render.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("gone"));
    expect(await runAuto({ develop: dev.store, render })).toBe(false);
    expect(await runAuto({ develop: dev.store, render })).toBe(false);
    expect(render).toHaveBeenCalledTimes(2);
    expect(dev.commits).toEqual([]);
    expect(dev.store.getState().paramBag).toBe(before);
  });

  it("leaves the new photo alone when another one opens mid-render", async () => {
    const dev = fakeDevelop(new Map([["p", treatmentPatch(true)], ["q", { "x.y": 1 }]]));
    await dev.store.getState().loadEdit("p");
    const frame = twoColourFrame();
    const render = async () => {
      await dev.store.getState().loadEdit("q");
      return frame;
    };
    expect(await runAuto({ develop: dev.store, render })).toBe(false);
    expect(dev.commits).toEqual([]);
    expect(dev.store.getState().paramBag).toEqual({ "x.y": 1 });
  });

  it("does nothing when no photo is open, even if the render returns a frame", async () => {
    const dev = fakeDevelop();
    const frame = twoColourFrame();
    expect(await runAuto({ develop: dev.store, render: async () => frame })).toBe(false);
    expect(dev.commits).toEqual([]);
    expect(dev.store.getState().paramBag).toEqual({});
  });
});
