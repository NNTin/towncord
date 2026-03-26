import { describe, expect, test } from "vitest";
import {
  normalizeTerrainPhaseDurations,
  resolveTerrainPhaseIndex,
} from "../../../engine/terrain/terrainRenderer";

describe("terrain timing helpers", () => {
  test("pads partial exported phase timings to the available variant count", () => {
    expect(normalizeTerrainPhaseDurations([90, 180], 4, 120)).toEqual([90, 180, 120, 120]);
  });

  test("cycles through exported phase durations deterministically", () => {
    expect(resolveTerrainPhaseIndex(50, [100, 200])).toBe(0);
    expect(resolveTerrainPhaseIndex(150, [100, 200])).toBe(1);
    expect(resolveTerrainPhaseIndex(250, [100, 200])).toBe(1);
    expect(resolveTerrainPhaseIndex(350, [100, 200])).toBe(0);
  });
});
