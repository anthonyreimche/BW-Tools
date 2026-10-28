import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LABEL_BW } from "../src/actions";
import { BwPanel, colourHint, pressAuto, weightsReadout } from "../src/Panel";
import { DEFAULTS, KEY, paramsPatch, readParams, type BwParams } from "../src/params";
import { initRuntime } from "../src/runtime";
import type { SafelightAPI } from "../src/safelight";
import { initStore, store, type AutoStatus } from "../src/store";
import { BAND_LABELS } from "../src/tables";
import { foreignSignature } from "../src/TargetOverlay";
import { elements, fakePanelApi, fakeStore, type FakeElement, type MaskStore, type PanelRig } from "./support/fake-api";

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

const bwBag = (over: Partial<BwParams> = {}) => paramsPatch({ ...DEFAULTS, on: true, ...over });

function find(tree: FakeElement[], type: string, match: (props: Record<string, unknown>) => boolean): FakeElement {
  const found = tree.find((el) => el.type === type && match(el.props));
  if (!found) throw new Error(`no ${type} matched`);
  return found;
}

const call = (el: FakeElement, handler: string, ...args: unknown[]): unknown => {
  const fn = el.props[handler];
  if (typeof fn !== "function") throw new Error(`${String(el.type)} has no ${handler}`);
  return (fn as (...a: unknown[]) => unknown)(...args);
};

const slider = (tree: FakeElement[], label: string) => find(tree, "Slider", (p) => p.label === label);
const buttons = (tree: FakeElement[], text: string) =>
  tree.filter((el) => el.type === "Button" && el.children.includes(text));
const texts = (tree: FakeElement[]) => tree.flatMap((el) => el.children.filter((c) => typeof c === "string"));

describe("BwPanel in the dock", () => {
  let rig: PanelRig;
  const render = () => elements(BwPanel());

  beforeEach(() => {
    rig = fakePanelApi(bwBag({ hiSat: 10 }));
    initRuntime(rig.api);
    initStore();
  });

  it("edits the photo's own values", () => {
    const tree = render();
    call(slider(tree, "Highlights saturation"), "onChange", 40);
    call(slider(tree, "Highlights saturation"), "onCommit");
    expect(readParams(rig.develop.store.getState().paramBag).hiSat).toBe(40);
    expect(rig.develop.commits.map((c) => c.label)).toEqual(["Black & White highlights saturation"]);
  });

  // The positive control for the mask's version: the same search finds both
  // tools here, and they reach the photo.
  it("offers Auto, which renders the photo, and the target tool", () => {
    const tree = render();
    expect(buttons(tree, "Auto")).toHaveLength(1);
    call(buttons(tree, "Target")[0], "onClick");
    expect(store().getState().target).toBe(true);
    call(buttons(tree, "Auto")[0], "onClick");
    expect(rig.renders).toEqual(["p"]);
  });
});

// The same panel edits a mask in the Masking panel's Adjust tab. Auto and the
// target tool read the whole photo and write the photo's own mix, so they
// aren't there.
describe("BwPanel in a mask", () => {
  let rig: PanelRig;
  let mask: MaskStore;
  const render = () => elements(BwPanel());

  function mount(photoBag: Record<string, unknown>, maskBag: Record<string, unknown>) {
    rig = fakePanelApi(photoBag);
    mask = rig.inMask(maskBag);
    initRuntime(rig.api);
    initStore();
  }

  it("shows the mask's values, not the photo's", () => {
    mount(bwBag({ response: 1 }), bwBag({ response: 5 }));
    expect(find(render(), "Select", (p) => p.ariaLabel === "Response").props.value).toBe("5");
    mount(bwBag(), {});
    expect(find(render(), "SegmentedControl", () => true).props.value).toBe("colour");
  });

  it("writes a slider to the mask and commits it there, leaving the photo alone", () => {
    const photo = bwBag({ hiSat: 10 });
    mount(photo, bwBag());
    const tree = render();
    call(slider(tree, "Highlights saturation"), "onChange", 40);
    call(slider(tree, "Highlights saturation"), "onCommit");
    expect(readParams(mask.getState().bag).hiSat).toBe(40);
    expect(rig.develop.store.getState().paramBag).toEqual(photo);
    expect(rig.develop.commits).toEqual([]);
    expect(rig.maskCommits).toEqual(["Black & White highlights saturation"]);
  });

  // Moves outrun renders, so each starts from the mask's bands as they are now.
  it("moves a band from the mask's own mix as it stands", () => {
    const photo = bwBag({ bands: [50, 50, 50, 50, 50, 50, 50, 50] });
    mount(photo, bwBag({ bands: [10, 0, 0, 0, 0, 0, 0, 0] }));
    const tree = render();
    call(slider(tree, BAND_LABELS[2]), "onChange", 30);
    call(slider(tree, BAND_LABELS[3]), "onChange", -20);
    expect(readParams(mask.getState().bag).bands).toEqual([10, 0, 30, -20, 0, 0, 0, 0]);
    expect(rig.develop.store.getState().paramBag).toEqual(photo);
  });

  it("switches the mask's treatment, both stages' flags, as one step", () => {
    const photo = bwBag();
    mount(photo, {});
    const treatment = find(render(), "SegmentedControl", () => true);
    call(treatment, "onChange", "bw");
    call(treatment, "onChange", "bw");
    expect(mask.getState().bag).toMatchObject({ [KEY.convertOn]: 1, [KEY.toneOn]: 1 });
    expect(rig.develop.store.getState().paramBag).toEqual(photo);
    expect(rig.maskCommits).toEqual([LABEL_BW]);
  });

  it("says how to convert inside the mask, without the photo's shortcut", () => {
    mount(bwBag(), {});
    const hint = texts(render()).filter((t) => t.includes("Black & White"));
    expect(hint).toEqual(["Choose Black & White to convert inside this mask."]);
  });

  it("leaves out Auto and the target tool, so nothing in it reads the photo or arms a canvas tool", () => {
    const photo = bwBag();
    mount(photo, bwBag());
    const tree = render();
    expect(buttons(tree, "Auto")).toEqual([]);
    expect(buttons(tree, "Target")).toEqual([]);
    for (const el of tree) if (typeof el.props.onClick === "function") call(el, "onClick");
    expect(store().getState().target).toBe(false);
    expect(rig.renders).toEqual([]);
    expect(rig.develop.store.getState().paramBag).toEqual(photo);
    expect(rig.develop.commits).toEqual([]);
  });
});
