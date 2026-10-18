// The Develop panel. In Colour treatment it shows the treatment switch and
// how to reach it; in Black & White, the conversion, the eight-colour mix
// (with Auto and the target tool), selective colour and toning. Sliders write
// the bag live and commit one undo step on release.

import type { CSSProperties, ReactElement } from "react";
import { LABEL_BW, LABEL_COLOUR, runAuto } from "./actions";
import { conversionWeights } from "./model";
import {
  DEFAULTS,
  TOGGLE_ACTION,
  fieldPatch,
  paramsPatch,
  readParams,
  treatmentPatch,
  type BwParams,
  type NumericKey,
} from "./params";
import { api, h } from "./runtime";
import { store } from "./store";
import { BAND_LABELS, CUSTOM_RESPONSE, FILTERS, RESPONSES, TONERS } from "./tables";

const PAD: CSSProperties = { padding: "6px 8px 8px" };
const HINT: CSSProperties = { margin: 0, fontSize: 10, lineHeight: 1.4, color: "var(--color-text-muted)" };
const LABEL: CSSProperties = { fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" };
const GROW: CSSProperties = { flex: "1 1 auto", minWidth: 0 };
const AUTO_FAILED_MS = 2000;

/** A hue slider's track: the colour wheel unrolled. */
export const HUE_TRACK =
  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

export function colourHint(combo: string): string {
  return combo ? `Press ${combo} or choose Black & White.` : "Choose Black & White to convert this photo.";
}

export function weightsReadout(p: BwParams): string {
  const [r, g, b] = conversionWeights(p);
  return `Normalised: R ${r.toFixed(2)} · G ${g.toFixed(2)} · B ${b.toFixed(2)}`;
}

/** Runs Auto and keeps the session's status in step. A run that throws (a
 *  commit that can't reach storage) counts as a failed one: busy always clears,
 *  or Auto would stay disabled until the app restarts. */
export async function pressAuto(run: () => Promise<boolean> = runAuto): Promise<void> {
  store().getState().setAuto("busy");
  let ok = false;
  try {
    ok = await run();
  } catch (err) {
    console.warn("[black-and-white] Auto failed:", err);
  } finally {
    store().getState().setAuto(ok ? "idle" : "failed");
  }
  if (!ok) {
    setTimeout(() => {
      if (store().getState().auto === "failed") store().getState().setAuto("idle");
    }, AUTO_FAILED_MS);
  }
}

type Choice = "response" | "filterType" | "toner";

export function BwPanel(): ReactElement {
  const { Slider } = api().components;
  const { Button, Select, SegmentedControl, Section, Row, Stack } = api().ui;
  const dev = api().stores.useDevelopStore;
  const paramBag = dev((s) => s.paramBag);
  const photoId = dev((s) => s.photoId);
  const target = store()((s) => s.target);
  const auto = store()((s) => s.auto);
  const p = readParams(paramBag);

  const write = (patch: Record<string, number>) => dev.getState().setDynParams(patch);
  const commit = (what: string) => void dev.getState().commitEdit(`Black & White ${what}`);

  const slider = (label: string, key: NumericKey, min: number, max: number, track?: string) =>
    h(Slider, {
      key,
      label,
      value: p[key],
      min,
      max,
      step: 1,
      defaultValue: DEFAULTS[key],
      trackBackground: track,
      onChange: (v: number) => write(fieldPatch(key, v)),
      onCommit: () => commit(label.toLowerCase()),
    });

  const bandSlider = (label: string, i: number) =>
    h(Slider, {
      key: `band${i}`,
      label,
      value: p.bands[i],
      min: -100,
      max: 100,
      step: 1,
      defaultValue: 0,
      onChange: (v: number) => {
        const bands = [...readParams(dev.getState().paramBag).bands];
        bands[i] = v;
        write(paramsPatch({ bands }));
      },
      onCommit: () => commit(`${label.toLowerCase()} mix`),
    });

  const choice = (label: string, key: Choice, options: readonly { label: string }[]) =>
    h(
      Row,
      { key, gap: 6 },
      h("span", { style: LABEL }, label),
      h(
        "div",
        { style: GROW },
        h(Select, {
          value: String(p[key]),
          ariaLabel: label,
          options: options.map((o, i) => ({ value: String(i), label: o.label })),
          onChange: (v: string) => {
            write(fieldPatch(key, Number(v)));
            commit(label.toLowerCase());
          },
        }),
      ),
    );

  const setTreatment = (on: boolean) => {
    if (on === readParams(dev.getState().paramBag).on) return;
    write(treatmentPatch(on));
    void dev.getState().commitEdit(on ? LABEL_BW : LABEL_COLOUR);
  };

  const treatment = h(SegmentedControl, {
    key: "treatment",
    value: p.on ? "bw" : "colour",
    size: "sm",
    options: [
      { value: "colour", label: "Colour" },
      { value: "bw", label: "Black & White" },
    ],
    onChange: (v: string) => setTreatment(v === "bw"),
  });

  if (!p.on) {
    return h(
      Stack,
      { gap: 6, style: PAD },
      treatment,
      h("p", { key: "hint", style: HINT }, colourHint(api().keybindings.getBinding(TOGGLE_ACTION))),
    );
  }

  const custom = p.response === CUSTOM_RESPONSE;
  const mixTools = h(
    Row,
    { gap: 4 },
    h(
      Button,
      {
        size: "sm",
        disabled: !photoId || auto === "busy",
        title: "Set the eight colours so the photo's colour contrast survives in grey",
        onClick: () => void pressAuto(),
      },
      auto === "failed" ? "Couldn't read the photo" : "Auto",
    ),
    h(
      Button,
      {
        size: "sm",
        active: target,
        disabled: !photoId,
        title: "Drag up or down over a colour in the photo to lighten or darken it (Esc ends)",
        onClick: () => store().getState().setTarget(!target),
      },
      "Target",
    ),
  );

  return h(
    Stack,
    { gap: 8, style: PAD },
    treatment,
    h(
      Section,
      { key: "conversion", title: "Conversion" },
      h(
        Stack,
        { gap: 4 },
        choice("Response", "response", RESPONSES),
        custom ? slider("Red", "mixR", -200, 200) : null,
        custom ? slider("Green", "mixG", -200, 200) : null,
        custom ? slider("Blue", "mixB", -200, 200) : null,
        custom ? h("p", { key: "weights", style: HINT }, weightsReadout(p)) : null,
        choice("Filter", "filterType", FILTERS),
        p.filterType !== 0 ? slider("Strength", "filterStrength", 0, 100) : null,
      ),
    ),
    h(
      Section,
      { key: "mix", title: "Mix", right: mixTools },
      h(Stack, { gap: 1 }, ...BAND_LABELS.map((label, i) => bandSlider(label, i))),
    ),
    h(
      Section,
      { key: "keep", title: "Selective colour" },
      h(
        Stack,
        { gap: 1 },
        slider("Hue", "keepHue", 0, 360, HUE_TRACK),
        slider("Range", "keepRange", 5, 90),
        slider("Amount", "keepAmount", 0, 100),
      ),
    ),
    h(
      Section,
      { key: "toning", title: "Toning" },
      h(
        Stack,
        { gap: 4 },
        choice("Toner", "toner", TONERS),
        p.toner !== 0 ? slider("Strength", "tonerStrength", 0, 100) : null,
        slider("Highlights hue", "hiHue", 0, 360, HUE_TRACK),
        slider("Highlights saturation", "hiSat", 0, 100),
        slider("Shadows hue", "shHue", 0, 360, HUE_TRACK),
        slider("Shadows saturation", "shSat", 0, 100),
        slider("Balance", "balance", -100, 100),
        slider("Paper hue", "paperHue", 0, 360, HUE_TRACK),
        slider("Paper saturation", "paperSat", 0, 100),
      ),
    ),
  );
}
