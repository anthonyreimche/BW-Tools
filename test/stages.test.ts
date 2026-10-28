import { describe, expect, it } from "vitest";
import { CONVERT_GLSL, CONVERT_HELPERS, TONE_GLSL, TONE_HELPERS } from "../src/glsl";
import { CONVERT_ID, FIELDS, TONE_ID } from "../src/params";
import { allStages, convertStage, stageUniforms, toneStage } from "../src/stages";

describe("stages", () => {
  it("places the conversion late in scene-linear and the toning in display-adjust", () => {
    expect(convertStage()).toMatchObject({
      id: CONVERT_ID,
      name: "Black & White",
      phase: "scene-linear",
      priority: 900,
      glsl: CONVERT_GLSL,
      helpers: CONVERT_HELPERS,
      presetScope: "global",
    });
    expect(toneStage()).toMatchObject({
      id: TONE_ID,
      name: "Black & White toning",
      phase: "display-adjust",
      priority: 100,
      glsl: TONE_GLSL,
      helpers: TONE_HELPERS,
      presetScope: "global",
    });
    expect(allStages().map((s) => s.id)).toEqual([CONVERT_ID, TONE_ID]);
  });

  // The phases the host masks in; a stage elsewhere is refused a copy.
  it("both run again inside masks, from phases the host can mask", () => {
    for (const s of allStages()) {
      expect(s.mask).toEqual({ maskable: true });
      expect(["scene-linear", "tone-map", "display-adjust", "effects", "output-encode"]).toContain(s.phase);
    }
  });

  it("declare no passes or reads", () => {
    for (const s of allStages()) {
      expect("passes" in s).toBe(false);
      expect("reads" in s).toBe(false);
    }
  });

  // A display stage that declares no space is handed clipped values on process
  // version 2, and the host clips ahead of its block, outside its `on` gate:
  // that would clip every Colour photo. Declaring the display's own space emits
  // neither a conversion nor a clamp. The scene-linear stage needs no clip.
  it("lets only the toning declare the display's own space", () => {
    expect("space" in convertStage()).toBe(false);
    expect(toneStage().space).toEqual({ encoding: "perceptual" });
  });

  it("declare one uniform per field with its default, range and label", () => {
    for (const stage of ["convert", "tone"] as const) {
      const fields = FIELDS.filter((f) => f.stage === stage);
      expect(stageUniforms(stage)).toEqual(
        fields.map((f) => ({
          key: f.key,
          glslType: f.type,
          default: f.def,
          range: { min: f.min, max: f.max, step: 1 },
          label: f.label,
        })),
      );
    }
  });
});
