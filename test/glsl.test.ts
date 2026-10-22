import { describe, expect, it } from "vitest";
import { CONVERT_GLSL, CONVERT_HELPERS, TONE_GLSL, TONE_HELPERS } from "../src/glsl";
import { FIELDS } from "../src/params";
import { inlineFetches } from "./support/fetch-budget";

const SOURCES = { CONVERT_GLSL, CONVERT_HELPERS, TONE_GLSL, TONE_HELPERS };
const keysOf = (stage: "convert" | "tone") => FIELDS.filter((f) => f.stage === stage).map((f) => f.key);

/** Identifiers the GLSL declares as function parameters or locals. */
function declared(src: string): string[] {
  const names: string[] = [];
  const decl = /\b(?:float|int|bool|vec[234]|ivec[234])\s+(\w+)\s*(?:=|;|,|\))/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(src))) names.push(m[1]);
  return names;
}

describe("stage GLSL", () => {
  it("has no preprocessor directives and no backticks", () => {
    for (const [name, src] of Object.entries(SOURCES)) {
      expect(src, name).not.toMatch(/#/);
      expect(src, name).not.toMatch(/`/);
    }
  });

  it("writes every generated table constant as a float literal", () => {
    const args = /(?:vec[23]|float\[8\])\(([^()]*)\)/g;
    for (const [name, src] of Object.entries(SOURCES)) {
      let m: RegExpExecArray | null;
      while ((m = args.exec(src))) {
        for (const a of m[1].split(",").map((s) => s.trim())) {
          if (/^-?\d/.test(a)) expect(a, `${name}: ${m[0]}`).toMatch(/[.e]/);
        }
      }
    }
  });

  // The host clips a display stage's input only if the stage declares no
  // space, and does it outside the stage's gate. The tone stage declares one,
  // so its own block clips, behind its gate: treatment on and a toner, split
  // tone or paper tint set. A plain conversion keeps its range.
  it("clips the display colour to [0, 1] first thing inside the tone block, only while toning is set", () => {
    expect(
      TONE_GLSL.startsWith(
        "if (on > 0.5 && (toner != 0 || hiSat != 0.0 || shSat != 0.0 || paperSat != 0.0)) {\n  c = clamp(c, 0.0, 1.0);\n",
      ),
    ).toBe(true);
  });

  it("reads no textures", () => {
    expect(inlineFetches(CONVERT_GLSL, CONVERT_HELPERS)).toBe(0);
    expect(inlineFetches(TONE_GLSL, TONE_HELPERS)).toBe(0);
  });

  it("uses every uniform its stage declares", () => {
    for (const k of keysOf("convert")) expect(CONVERT_GLSL).toMatch(new RegExp(`\\b${k}\\b`));
    for (const k of keysOf("tone")) expect(TONE_GLSL).toMatch(new RegExp(`\\b${k}\\b`));
  });

  it("never names a parameter or local like a uniform key (the host rewrites them by word)", () => {
    const keys = new Set([...keysOf("convert"), ...keysOf("tone")]);
    for (const [name, src] of Object.entries(SOURCES)) {
      for (const id of declared(src)) expect(keys.has(id), `${name}: ${id}`).toBe(false);
    }
  });

  it("declares helpers as functions only", () => {
    for (const src of [CONVERT_HELPERS, TONE_HELPERS]) {
      const topLevel = src.replace(/\{[^{}]*\}/g, "").replace(/\{[^{}]*\}/g, "").replace(/\{[^{}]*\}/g, "");
      expect(topLevel).not.toMatch(/\bconst\b/);
      expect(topLevel).not.toMatch(/\buniform\b/);
    }
  });
});
