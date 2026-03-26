import { describe, expect, test } from "vitest";
import {
  resolveOfficeFloorAppearance,
  resolveOfficeTileColorAdjustPreset,
} from "../colors";

describe("resolveOfficeTileColorAdjustPreset", () => {
  test("falls back to the neutral preset for invalid keys", () => {
    expect(resolveOfficeTileColorAdjustPreset("toString")).toEqual(
      resolveOfficeTileColorAdjustPreset("neutral"),
    );
  });
});

describe("resolveOfficeFloorAppearance", () => {
  test("derives a preset color adjust and tint from a tile color", () => {
    const result = resolveOfficeFloorAppearance(null, "blue");

    expect(result.colorAdjust).toEqual(resolveOfficeTileColorAdjustPreset("blue"));
    expect(result.tint).toBe(0x2563eb);
  });

  test("clones raw floor color adjust input before resolving tint", () => {
    const floorColor = { h: 214, s: 30, b: -100, c: -55 };
    const result = resolveOfficeFloorAppearance(floorColor, null);

    expect(result.colorAdjust).toEqual(floorColor);
    expect(result.colorAdjust).not.toBe(floorColor);
    expect(result.tint).toBeTypeOf("number");
  });
});
