// Black & White — Safelight extension (MIT).
//
// Monochrome conversion in scene-linear light and print toning in display
// space. Registers the two stages (stages.ts, both maskable), the Develop
// panel (Panel.ts, which masks can add too), the target tool
// (TargetOverlay.ts), the V shortcut and the Library right-click converts
// (actions.ts), and keeps the two stages' treatment flags in step.

import { convertPhotos, liveConvertDeps, menuLabel, toggleTreatment } from "./actions";
import { BwPanel } from "./Panel";
import { EXT_ID, FIELDS, OVERLAY_ID, PANEL_ID, TOGGLE_ACTION, qualified, repairPatch, resetPatch } from "./params";
import { api, initRuntime } from "./runtime";
import type { DevelopStoreState, SafelightAPI } from "./safelight";
import { allStages } from "./stages";
import { initStore, store } from "./store";
import { TargetOverlay } from "./TargetOverlay";

let unsubscribe: (() => void) | null = null;

function reset(): void {
  const dev = api().stores.useDevelopStore.getState();
  dev.setDynParams(resetPatch());
  void dev.commitEdit("Black & White reset");
}

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  initStore();

  for (const stage of allStages()) host.registerProcessingStage(stage);

  host.registerPanel({
    id: PANEL_ID,
    title: "Black & White",
    component: BwPanel,
    // Just below core HSL (order 11), which the mix stands in for in B&W.
    defaultDock: { module: "develop", direction: "right", order: 12, width: 280 },
    onReset: reset,
    // The same panel edits a mask's conversion and toning in the Masking
    // panel's Adjust tab. It writes every key of both stages, flags included.
    mask: { component: BwPanel, owns: FIELDS.map(qualified) },
  });

  host.registerSlot({ id: OVERLAY_ID, slot: "develop-canvas-overlay", component: TargetOverlay, order: 60 });

  host.registerKeybinding({
    id: TOGGLE_ACTION,
    label: "Toggle Black & White",
    category: "Develop",
    defaultCombo: "V",
    handler: () => toggleTreatment(),
  });

  host.registerGridMenuItem({
    id: `${EXT_ID}.to-bw`,
    label: menuLabel("Convert to Black & White"),
    onClick: (ids) => void convertPhotos(ids, true, liveConvertDeps()),
  });
  host.registerGridMenuItem({
    id: `${EXT_ID}.to-colour`,
    label: menuLabel("Convert to Colour"),
    onClick: (ids) => void convertPhotos(ids, false, liveConvertDeps()),
  });

  // A bag with only one stage's flag (a preset saved from one stage's keys, an
  // edit from another release) is mended live; the next commit stores it.
  unsubscribe = host.stores.useDevelopStore.subscribe((state: DevelopStoreState, prev: DevelopStoreState) => {
    if (state.paramBag === prev.paramBag) return;
    const patch = repairPatch(state.paramBag);
    if (patch) state.setDynParams(patch);
  });
}

export function deactivate(): void {
  unsubscribe?.();
  unsubscribe = null;
  // The host sweeps this extension's registrations on disable or uninstall;
  // dropping them explicitly keeps a re-enable clean.
  try {
    store().getState().setTarget(false);
    const host = api();
    for (const stage of allStages()) host.unregisterProcessingStage(stage.id);
    host.unregisterSlot(OVERLAY_ID);
  } catch {
    /* activate() never ran — nothing to tear down */
  }
}
