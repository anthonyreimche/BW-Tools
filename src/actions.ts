// Whole-photo actions: the V shortcut, the Library right-click convert and
// Auto. The convert goes through the develop store the way Batch Tools does:
// extensions can't read the core's default params, so loading each photo is
// the only way to convert one that was never edited, and it gives every photo
// an ordinary undoable history entry. The as-shot temperature is passed to
// loadEdit, or the regenerated grid thumbnail goes warm.

import { autoBands } from "./auto";
import type { FrameSample } from "./frame";
import { isOn, paramsPatch, readParams, treatmentPatch } from "./params";
import { api } from "./runtime";
import type { DevelopStoreState, StoreApi } from "./safelight";
import { AUTO_LONG_EDGE, renderOriginal } from "./sample";

export const LABEL_BW = "Black & White";
export const LABEL_COLOUR = "Colour";

export interface ToggleDeps {
  develop: StoreApi<DevelopStoreState>;
  inDevelop(): boolean;
}

/** Whether this window is showing Develop. A window popped out of Develop
 *  (`?detached=develop`) keeps an active module of its own, and the host sends
 *  extension key actions to it without looking at the module. */
export function developActive(activeModule: string, search: string): boolean {
  return activeModule === "develop" || new URLSearchParams(search).get("detached") === "develop";
}

function liveInDevelop(): boolean {
  return developActive(api().stores.useUIStore.getState().activeModule, globalThis.location?.search ?? "");
}

function liveToggleDeps(): ToggleDeps {
  return { develop: api().stores.useDevelopStore, inDevelop: liveInDevelop };
}

export function toggleTreatment(deps: ToggleDeps = liveToggleDeps()): void {
  if (!deps.inDevelop()) return;
  const s = deps.develop.getState();
  if (!s.photoId) return;
  const on = !isOn(s.paramBag);
  s.setDynParams(treatmentPatch(on));
  void s.commitEdit(on ? LABEL_BW : LABEL_COLOUR);
}

export interface ConvertDeps {
  develop: StoreApi<DevelopStoreState>;
  asShot(photoId: string): number | undefined;
  /** The photo to load back afterwards (the one open in Develop). */
  restoreId: string | null;
  inDevelop(): boolean;
  warn(message: string): void;
  yieldToUi(): Promise<void>;
}

export function liveConvertDeps(): ConvertDeps {
  const a = api();
  const catalog = a.stores.useCatalogStore;
  return {
    develop: a.stores.useDevelopStore,
    asShot: (id) => catalog.getState().photos.find((p) => p.id === id)?.exif.colorTemperature,
    restoreId: catalog.getState().activePhotoId ?? a.stores.useDevelopStore.getState().photoId,
    inDevelop: liveInDevelop,
    warn: (message) => console.warn(message),
    yieldToUi: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

// Every run drives the one develop store, so two at once (or a run and the
// user opening a photo) would commit to the wrong photo.
let converting = false;

/** Converts the photos one at a time through the develop store. Stops, leaving
 *  the store alone, as soon as it holds a photo this run didn't load (the user
 *  or another loader took it); stops but still restores when the user enters
 *  Develop during the run (a run started inside Develop, from a filmstrip's
 *  menu, carries on). Photos not reached are neither converted nor failed. */
export async function convertPhotos(
  ids: readonly string[],
  on: boolean,
  deps: ConvertDeps,
): Promise<{ converted: string[]; failed: string[] }> {
  const converted: string[] = [];
  const failed: string[] = [];
  if (converting) {
    deps.warn("[black-and-white] A conversion is already running.");
    return { converted, failed };
  }
  converting = true;
  try {
    let expected = deps.develop.getState().photoId;
    let ownsStore = true;
    const startedInDevelop = deps.inDevelop();
    try {
      for (const id of ids) {
        if (!startedInDevelop && deps.inDevelop()) break;
        if (deps.develop.getState().photoId !== expected) {
          ownsStore = false;
          break;
        }
        try {
          await deps.develop.getState().loadEdit(id, deps.asShot(id));
          const s = deps.develop.getState();
          if (s.photoId !== id) {
            ownsStore = false;
            break;
          }
          expected = id;
          if (isOn(s.paramBag) !== on) {
            s.setDynParams(treatmentPatch(on));
            await s.commitEdit(on ? LABEL_BW : LABEL_COLOUR);
            converted.push(id);
          }
        } catch {
          failed.push(id);
        }
        await deps.yieldToUi();
      }
    } finally {
      if (ownsStore && deps.restoreId && deps.develop.getState().photoId === expected) {
        try {
          await deps.develop.getState().loadEdit(deps.restoreId, deps.asShot(deps.restoreId));
        } catch {
          if (!failed.includes(deps.restoreId)) failed.push(deps.restoreId);
        }
      }
    }
  } finally {
    converting = false;
  }
  if (failed.length > 0) {
    deps.warn(`[black-and-white] ${failed.length} photo(s) could not be converted: ${failed.join(", ")}`);
  }
  return { converted, failed };
}

export const menuLabel =
  (base: string) =>
  (ids: string[]): string =>
    ids.length > 1 ? `${base} (${ids.length})` : base;

export interface AutoDeps {
  develop: StoreApi<DevelopStoreState>;
  render(): Promise<FrameSample | null>;
}

function liveAutoDeps(): AutoDeps {
  return { develop: api().stores.useDevelopStore, render: () => renderOriginal(AUTO_LONG_EDGE) };
}

/** Sets the eight bands from the photo's original colours, as one undo step.
 *  False when there is no photo, it couldn't be read, or another photo opened
 *  while it rendered (committing then would put this run's step in that
 *  photo's history). */
export async function runAuto(deps: AutoDeps = liveAutoDeps()): Promise<boolean> {
  const photoId = deps.develop.getState().photoId;
  if (!photoId) return false;
  let frame: FrameSample | null;
  try {
    frame = await deps.render();
  } catch {
    return false;
  }
  if (!frame) return false;
  const s = deps.develop.getState();
  if (s.photoId !== photoId) return false;
  s.setDynParams(paramsPatch({ bands: autoBands(frame, readParams(s.paramBag)) }));
  await s.commitEdit("Black & White Auto");
  return true;
}
