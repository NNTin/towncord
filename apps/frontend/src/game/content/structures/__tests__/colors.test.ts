import { describe, expect, test } from "vitest";
import {
  DEFAULT_WALL_COLOR_ADJUST,
  resolveOfficeFloorAppearance,
  resolveOfficeWallAppearance,
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

describe("resolveOfficeWallAppearance", () => {
  test("uses the default wall tint when no wall color is provided", () => {
    const result = resolveOfficeWallAppearance(null);

    expect(result.colorAdjust).toEqual(DEFAULT_WALL_COLOR_ADJUST);
    expect(result.tint).toBe(0x334155);
  });

  test("clones raw wall color adjust input before resolving tint", () => {
    const wallColor = { h: 214, s: 25, b: -54, c: 17 };
    const result = resolveOfficeWallAppearance(wallColor);

    expect(result.colorAdjust).toEqual(wallColor);
    expect(result.colorAdjust).not.toBe(wallColor);
    expect(result.tint).toBe(0x334155);
  });
});
