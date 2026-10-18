// The two processing stages. No passes: both are per-pixel point operations,
// so they cost no texture fetches and the host never runs a prepass for them.

import { CONVERT_GLSL, CONVERT_HELPERS, TONE_GLSL, TONE_HELPERS } from "./glsl";
import { CONVERT_ID, FIELDS, TONE_ID, type FieldSpec } from "./params";
import type { ProcessingStageContribution, UniformDeclaration } from "./safelight";

export function stageUniforms(stage: FieldSpec["stage"]): UniformDeclaration[] {
  return FIELDS.filter((f) => f.stage === stage).map((f) => ({
    key: f.key,
    glslType: f.type,
    default: f.def,
    range: { min: f.min, max: f.max, step: 1 },
    label: f.label,
  }));
}

export function convertStage(): ProcessingStageContribution {
  return {
    id: CONVERT_ID,
    name: "Black & White",
    // Late in scene-linear: colour extensions in this phase act as
    // pre-conversion filters, and tone-map stages see the mono image.
    phase: "scene-linear",
    priority: 900,
    glsl: CONVERT_GLSL,
    helpers: CONVERT_HELPERS,
    uniforms: stageUniforms("convert"),
    presetScope: "global",
  };
}

export function toneStage(): ProcessingStageContribution {
  return {
    id: TONE_ID,
    name: "Black & White toning",
    // After the core's display tools, so toning tints the finished print.
    phase: "display-adjust",
    priority: 100,
    glsl: TONE_GLSL,
    helpers: TONE_HELPERS,
    uniforms: stageUniforms("tone"),
    presetScope: "global",
    // Declared so the host adds no clip: on process version 2 a display stage
    // without a space is clipped ahead of its block, outside its `on` gate,
    // which would clip every Colour photo before the core Vignette and Grain.
    // The display's own space converts and clips nothing; the block clips its
    // input itself, once it is on.
    space: { encoding: "perceptual" },
  };
}

export function allStages(): ProcessingStageContribution[] {
  return [convertStage(), toneStage()];
}
