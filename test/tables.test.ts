import { describe, expect, it } from "vitest";
import {
  BAND_CENTRES,
  BAND_DNEXT,
  BAND_DPREV,
  BAND_LABELS,
  CUSTOM_RESPONSE,
  FILTERS,
  NEUTRAL_WEIGHTS,
  RESPONSES,
  TONERS,
  glslFloat,
  glslVec3,
} from "../src/tables";

describe("tables", () => {
  it("lists the seven responses with Custom last and Neutral = Rec.709 luminance", () => {
    expect(RESPONSES.map((r) => r.label)).toEqual([
      "Neutral",
      "Panchromatic",
      "Extended red",
      "Orthochromatic",
      "Blue-sensitive",
      "Infrared",
      "Custom",
    ]);
    expect(CUSTOM_RESPONSE).toBe(6);
    expect(RESPONSES[CUSTOM_RESPONSE].weights).toBeNull();
    expect(RESPONSES[0].weights).toEqual(NEUTRAL_WEIGHTS);
    expect(NEUTRAL_WEIGHTS).toEqual([0.2126, 0.7152, 0.0722]);
  });

  it("lists nine filters with None first", () => {
    expect(FILTERS.map((f) => f.label)).toEqual([
      "None",
      "Yellow (#8)",
      "Deep yellow (#15)",
      "Orange (#21)",
      "Red (#25)",
      "Deep red (#29)",
      "Yellow-green (#11)",
      "Green (#58)",
      "Blue (#47)",
    ]);
    expect(FILTERS[0].transmission).toEqual([1, 1, 1]);
  });

  it("lists eight toners with None (all zero) first", () => {
    expect(TONERS.map((t) => t.label)).toEqual([
      "None",
      "Sepia",
      "Selenium",
      "Gold",
      "Cyanotype",
      "Platinum",
      "Copper",
      "Split (selenium + sepia)",
    ]);
    expect(TONERS[0].nodes.every(([, s]) => s === 0)).toBe(true);
    for (const t of TONERS) expect(t.nodes.length).toBe(4);
  });

  it("mirrors core HSL's band centres and spacing, which tile the hue circle", () => {
    expect(BAND_LABELS).toEqual(["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"]);
    expect(BAND_CENTRES).toEqual([0, 30, 60, 120, 180, 240, 280, 320]);
    expect(BAND_DPREV).toEqual([40, 30, 30, 60, 60, 60, 40, 40]);
    expect(BAND_DNEXT).toEqual([30, 30, 60, 60, 60, 40, 40, 40]);
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      const gap = (BAND_CENTRES[next] - BAND_CENTRES[i] + 360) % 360;
      expect(BAND_DNEXT[i]).toBe(gap);
      expect(BAND_DPREV[next]).toBe(gap);
    }
  });
});

describe("glslFloat", () => {
  it("always prints a decimal point or an exponent", () => {
    expect(glslFloat(1)).toBe("1.0");
    expect(glslFloat(0)).toBe("0.0");
    expect(glslFloat(-0)).toBe("0.0");
    expect(glslFloat(-200)).toBe("-200.0");
    expect(glslFloat(0.2126)).toBe("0.2126");
    expect(glslFloat(-0.5)).toBe("-0.5");
    expect(glslFloat(1e-7)).toBe("1e-7");
  });

  it("refuses NaN and infinities", () => {
    expect(() => glslFloat(Number.NaN)).toThrow();
    expect(() => glslFloat(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("formats a vec3", () => {
    expect(glslVec3([1, 0.95, 0.35])).toBe("vec3(1.0, 0.95, 0.35)");
  });
});
