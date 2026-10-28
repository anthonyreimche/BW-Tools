import { afterEach, describe, expect, it, vi } from "vitest";
import { LABEL_BW } from "../src/actions";
import { activate, deactivate } from "../src/index";
import { BwPanel } from "../src/Panel";
import { CONVERT_ID, DEFAULTS, KEY, OVERLAY_ID, PANEL_ID, TOGGLE_ACTION, TONE_ID, isOn, paramsPatch, readParams } from "../src/params";
import type {
  CatalogStoreState,
  GridMenuItemContribution,
  KeyActionContribution,
  PanelContribution,
  ProcessingStageContribution,
  SafelightAPI,
  SlotContribution,
  UIStoreState,
} from "../src/safelight";
import { store } from "../src/store";
import { fakeDevelop, fakeStore } from "./support/fake-api";

function fakeApi() {
  const registered = {
    stages: [] as ProcessingStageContribution[],
    panels: [] as PanelContribution[],
    slots: [] as SlotContribution[],
    keys: [] as KeyActionContribution[],
    items: [] as GridMenuItemContribution[],
    unregisteredStages: [] as string[],
    unregisteredSlots: [] as string[],
  };
  const dev = fakeDevelop(new Map([["p", {}]]));
  const ui = fakeStore<UIStoreState>({ activeModule: "develop" });
  const catalog = fakeStore<CatalogStoreState>({ photos: [], activePhotoId: null });
  const host = {
    version: 1,
    extensionId: "black-and-white",
    registerProcessingStage: (c: ProcessingStageContribution) => void registered.stages.push(c),
    unregisterProcessingStage: (id: string) => void registered.unregisteredStages.push(id),
    registerPanel: (c: PanelContribution) => void registered.panels.push(c),
    registerSlot: (c: SlotContribution) => void registered.slots.push(c),
    unregisterSlot: (id: string) => void registered.unregisteredSlots.push(id),
    registerKeybinding: (c: KeyActionContribution) => void registered.keys.push(c),
    registerGridMenuItem: (c: GridMenuItemContribution) => void registered.items.push(c),
    stores: { create: fakeStore, useDevelopStore: dev.store, useUIStore: ui, useCatalogStore: catalog },
  } as unknown as SafelightAPI;
  return { host, registered, dev, ui };
}

describe("activate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    deactivate();
  });

  it("registers both stages, the panel, the overlay, the shortcut and two Library items", () => {
    const { host, registered } = fakeApi();
    activate(host);
    expect(registered.stages.map((s) => s.id)).toEqual([CONVERT_ID, TONE_ID]);
    expect(registered.panels).toHaveLength(1);
    expect(registered.panels[0]).toMatchObject({
      id: PANEL_ID,
      title: "Black & White",
      defaultDock: { module: "develop", direction: "right", order: 12, width: 280 },
    });
    expect(typeof registered.panels[0].onReset).toBe("function");
    expect(registered.slots).toMatchObject([{ id: OVERLAY_ID, slot: "develop-canvas-overlay" }]);
    expect(registered.keys).toMatchObject([
      { id: TOGGLE_ACTION, label: "Toggle Black & White", category: "Develop", defaultCombo: "V" },
    ]);
    expect(registered.items.map((i) => i.id)).toEqual(["black-and-white.to-bw", "black-and-white.to-colour"]);
    const label = registered.items[0].label;
    expect(typeof label === "function" ? label(["a", "b"]) : label).toBe("Convert to Black & White (2)");
  });

  // A key left out of `owns` would stay in a mask's bag after the panel is
  // removed, and keep that stage's copy running.
  it("offers the panel in masks, owning every key of both stages", () => {
    const { host, registered } = fakeApi();
    activate(host);
    const mask = registered.panels[0].mask;
    expect(mask?.component).toBe(BwPanel);
    const keys = registered.stages.flatMap((s) => s.uniforms.map((u) => `${s.id}.${u.key}`));
    expect([...(mask?.owns ?? [])].sort()).toEqual(keys.sort());
  });

  it("toggles the open photo from the shortcut", async () => {
    const { host, registered, dev } = fakeApi();
    activate(host);
    await dev.store.getState().loadEdit("p");
    registered.keys[0].handler();
    expect(isOn(dev.store.getState().paramBag)).toBe(true);
    expect(dev.commits.map((c) => c.label)).toEqual([LABEL_BW]);
  });

  // A window popped out of Develop gets the key action while its own active
  // module may read otherwise; its URL says what it is.
  it("toggles from a window popped out of Develop, and not from a Library window", async () => {
    const { host, registered, dev, ui } = fakeApi();
    activate(host);
    await dev.store.getState().loadEdit("p");
    ui.setState({ activeModule: "library" });
    vi.stubGlobal("location", { search: "?detached=library" });
    registered.keys[0].handler();
    expect(dev.commits).toEqual([]);
    vi.stubGlobal("location", { search: "?detached=develop" });
    registered.keys[0].handler();
    expect(dev.commits.map((c) => c.label)).toEqual([LABEL_BW]);
  });

  it("resets every value from the dock header as one step", () => {
    const { host, registered, dev } = fakeApi();
    activate(host);
    dev.store.setState({ paramBag: paramsPatch({ ...DEFAULTS, on: true, bands: [50, 0, 0, 0, 0, 0, 0, 0], toner: 3 }) });
    registered.panels[0].onReset?.();
    expect(readParams(dev.store.getState().paramBag)).toEqual(DEFAULTS);
    expect(dev.commits.map((c) => c.label)).toEqual(["Black & White reset"]);
  });

  it("repairs a bag whose two treatment flags disagree", () => {
    const { host, dev } = fakeApi();
    activate(host);
    dev.store.setState({ paramBag: { [KEY.convertOn]: 1 } });
    expect(dev.store.getState().paramBag[KEY.toneOn]).toBe(1);
  });

  it("drops the stages and the overlay, ends the target tool, and stops repairing on deactivate", () => {
    const { host, registered, dev } = fakeApi();
    activate(host);
    store().getState().setTarget(true);
    deactivate();
    expect(store().getState().target).toBe(false);
    expect(registered.unregisteredStages).toEqual([CONVERT_ID, TONE_ID]);
    expect(registered.unregisteredSlots).toEqual([OVERLAY_ID]);
    dev.store.setState({ paramBag: { [KEY.convertOn]: 1 } });
    expect(dev.store.getState().paramBag[KEY.toneOn]).toBeUndefined();
  });
});
