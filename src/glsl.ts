// The two stages' GLSL, generated from tables.ts. Each function mirrors one
// in model.ts, expression for expression. Uniform keys (on, response, band0,
// …) are written bare: the host rewrites them, by whole word, to the stage's
// namespaced uniforms, which is why no local or parameter may share a key's
// name. Helper names are namespaced by the host too. The tables live inside
// functions, never as global consts (both stages' helpers share one shader).
// luma() and linearToSrgb() are the host's documented helpers.

import {
  BAND_CENTRES,
  BAND_DNEXT,
  BAND_DPREV,
  CUSTOM_RESPONSE,
  FILTERS,
  MIX_EV,
  NEUTRAL_WEIGHTS,
  PAPER_MAX,
  RESPONSES,
  TINT_MAX,
  TONERS,
  WEIGHT_SUM_FLOOR,
  glslFloat,
  glslVec3,
} from "./tables";

const floats = (v: readonly number[]): string => v.map(glslFloat).join(", ");

const HUE = `float bwHue(vec3 e) {
  float mx = max(e.r, max(e.g, e.b));
  float d = mx - min(e.r, min(e.g, e.b));
  if (d < 1e-6) return 0.0;
  float h;
  if (e.r >= e.g && e.r >= e.b) h = mod((e.g - e.b) / d, 6.0);
  else if (e.g >= e.b) h = (e.b - e.r) / d + 2.0;
  else h = (e.r - e.g) / d + 4.0;
  return h * 60.0;
}`;

// x = hue in degrees, y = chroma.
const HUE_CHROMA = `vec2 bwHueChroma(vec3 rgb) {
  float m = max(rgb.r, max(rgb.g, rgb.b));
  if (m <= 1e-6) return vec2(0.0);
  vec3 e = linearToSrgb(max(rgb, vec3(0.0)) / m);
  float sat = 1.0 - min(e.r, min(e.g, e.b));
  return vec2(bwHue(e), smoothstep(0.0, 0.5, sat));
}`;

const BAND_WEIGHT = `float bwBandWeight(float hue, float centre, float dPrev, float dNext) {
  float d = mod(hue - centre + 540.0, 360.0) - 180.0;
  float t;
  if (d <= 0.0) {
    if (d <= -dPrev) return 0.0;
    t = (d + dPrev) / dPrev;
  } else {
    if (d >= dNext) return 0.0;
    t = 1.0 - d / dNext;
  }
  return t * t * (3.0 - 2.0 * t);
}`;

const MIX_AMOUNT = `float bwMixAmount(float hue, vec4 lo, vec4 hi) {
  const float CENTRE[8] = float[8](${floats(BAND_CENTRES)});
  const float PREV[8] = float[8](${floats(BAND_DPREV)});
  const float NEXT[8] = float[8](${floats(BAND_DNEXT)});
  float a = 0.0;
  for (int i = 0; i < 8; i++) {
    float amount = i < 4 ? lo[i] : hi[i - 4];
    a += (amount / 100.0) * bwBandWeight(hue, CENTRE[i], PREV[i], NEXT[i]);
  }
  return a;
}`;

const HUE_WINDOW = `float bwHueWindow(float hue, float centre, float halfWidth) {
  float d = abs(mod(hue - centre + 540.0, 360.0) - 180.0);
  if (d >= halfWidth) return 0.0;
  float t = 1.0 - d / halfWidth;
  return t * t * (3.0 - 2.0 * t);
}`;

function responseFn(): string {
  const cases = RESPONSES.flatMap((r, i) => (r.weights ? [`  if (id == ${i}) return ${glslVec3(r.weights)};`] : []));
  return `vec3 bwResponse(int id, vec3 custom) {
${cases.join("\n")}
  if (id == ${CUSTOM_RESPONSE}) return custom;
  return ${glslVec3(NEUTRAL_WEIGHTS)};
}`;
}

function filterFn(): string {
  const cases = FILTERS.slice(1).map((f, i) => `  if (id == ${i + 1}) return ${glslVec3(f.transmission)};`);
  return `vec3 bwFilter(int id) {
${cases.join("\n")}
  return vec3(1.0);
}`;
}

const WEIGHTS = `vec3 bwWeights(int responseId, vec3 custom, int filterId, float strength) {
  float s = clamp(strength / 100.0, 0.0, 1.0);
  vec3 v = bwResponse(responseId, custom) * (vec3(1.0) + (bwFilter(filterId) - vec3(1.0)) * s);
  return v / max(v.r + v.g + v.b, ${glslFloat(WEIGHT_SUM_FLOOR)});
}`;

export const CONVERT_HELPERS = [HUE, HUE_CHROMA, BAND_WEIGHT, MIX_AMOUNT, HUE_WINDOW, responseFn(), filterFn(), WEIGHTS].join("\n\n");

export const CONVERT_GLSL = `if (on > 0.5) {
  vec3 bwW = bwWeights(response, vec3(mixR, mixG, mixB) / 100.0, filterType, filterStrength);
  vec2 bwHc = bwHueChroma(lin);
  float bwY = max(dot(bwW, lin), 0.0);
  bwY *= exp2(${glslFloat(MIX_EV)} * bwHc.y * bwMixAmount(bwHc.x, vec4(band0, band1, band2, band3), vec4(band4, band5, band6, band7)));
  float bwKeep = clamp(keepAmount / 100.0, 0.0, 1.0) * bwHueWindow(bwHc.x, keepHue, keepRange) * bwHc.y;
  float bwL = luma(lin);
  vec3 bwColoured = bwL > 1e-6 ? lin * (bwY / bwL) : vec3(bwY);
  lin = vec3(bwY) * (1.0 - bwKeep) + bwColoured * bwKeep;
}`;

const HUE_RGB = `vec3 bwHueRgb(float hue) {
  return clamp(abs(mod(hue / 60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}`;

const TINT_DIR = `vec3 bwTintDir(float hue) {
  vec3 h = bwHueRgb(hue);
  vec3 d = h - vec3(luma(h));
  return d / max(abs(d.r), max(abs(d.g), abs(d.b)));
}`;

function tonerFn(): string {
  const cases = TONERS.slice(1).map((t, i) => {
    const [n0, n1, n2, n3] = t.nodes.map(([hue, s]) => `vec2(${glslFloat(hue)}, ${glslFloat(s)})`);
    return `  if (id == ${i + 1}) { if (k == 0) return ${n0}; if (k == 1) return ${n1}; if (k == 2) return ${n2}; return ${n3}; }`;
  });
  return `vec2 bwTonerNode(int id, int k) {
${cases.join("\n")}
  return vec2(0.0);
}`;
}

const RECIPE = `vec3 bwRecipeTint(int id, float lum) {
  float x = clamp(lum, 0.0, 1.0) * 3.0;
  int k = int(min(floor(x), 2.0));
  float f = x - float(k);
  vec2 a = bwTonerNode(id, k);
  vec2 b = bwTonerNode(id, k + 1);
  vec3 ta = bwTintDir(a.x) * (a.y * ${glslFloat(TINT_MAX)});
  vec3 tb = bwTintDir(b.x) * (b.y * ${glslFloat(TINT_MAX)});
  return ta * (1.0 - f) + tb * f;
}`;

const GAMUT = `float bwGamutAlpha(vec3 base, vec3 tint) {
  float a = 1.0;
  for (int i = 0; i < 3; i++) {
    if (tint[i] > 0.0) a = min(a, (1.0 - base[i]) / tint[i]);
    else if (tint[i] < 0.0) a = min(a, base[i] / -tint[i]);
  }
  return max(a, 0.0);
}`;

export const TONE_HELPERS = [HUE_RGB, TINT_DIR, tonerFn(), RECIPE, GAMUT].join("\n\n");

export const TONE_GLSL = `if (on > 0.5) {
  c = clamp(c, 0.0, 1.0);
  float bwL = luma(c);
  float bwPivot = 0.5 + (0.4 * balance) / 100.0;
  float bwHigh = smoothstep(bwPivot - 0.3, bwPivot + 0.3, bwL);
  vec3 bwShadows = bwTintDir(shHue) * ((1.0 - bwHigh) * (shSat / 100.0) * ${glslFloat(TINT_MAX)});
  vec3 bwHighs = bwTintDir(hiHue) * (bwHigh * (hiSat / 100.0) * ${glslFloat(TINT_MAX)});
  vec3 bwT = bwRecipeTint(toner, bwL) * clamp(tonerStrength / 100.0, 0.0, 1.0) + bwShadows + bwHighs;
  c = clamp(c + bwGamutAlpha(c, bwT) * bwT, 0.0, 1.0);
  if (paperSat > 0.0) {
    vec3 bwPaper = vec3(1.0) - ((paperSat / 100.0) * ${glslFloat(PAPER_MAX)}) * (vec3(1.0) - bwHueRgb(paperHue));
    float bwW = clamp(bwL, 0.0, 1.0);
    c = c * (vec3(1.0 - bwW) + bwPaper * bwW);
  }
}`;
