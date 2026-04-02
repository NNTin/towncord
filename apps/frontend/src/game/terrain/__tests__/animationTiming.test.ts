import { describe, expect, test } from "vitest";
import {
  buildTerrainPingPongFrameIndices,
  getTerrainAnimationId,
  normalizeTerrainPhaseDurations,
  resolveTerrainPhaseIndex,
  resolveTerrainPingPongFrameIndex,
} from "../../../engine/terrain/terrainRenderer";

describe("terrain animation timing", () => {
  test("derives the animation id from a base frame name", () => {
    expect(
      getTerrainAnimationId("tilesets.debug.environment.autotile-15#9"),
    ).toBe("tilesets.debug.environment.autotile-15");
  });

  test("normalizes exported durations and truncates to available variants", () => {
    expect(normalizeTerrainPhaseDurations([100, 120, 140], 2, 90)).toEqual([
      100, 120,
    ]);
    expect(normalizeTerrainPhaseDurations(undefined, 3, 90)).toEqual([
      90, 90, 90,
    ]);
  });

  test("resolves the current terrain phase from exported durations", () => {
    expect(resolveTerrainPhaseIndex(0, [100, 200, 50])).toBe(0);
    expect(resolveTerrainPhaseIndex(100, [100, 200, 50])).toBe(1);
    expect(resolveTerrainPhaseIndex(299, [100, 200, 50])).toBe(1);
    expect(resolveTerrainPhaseIndex(300, [100, 200, 50])).toBe(2);
    expect(resolveTerrainPhaseIndex(349, [100, 200, 50])).toBe(2);
    expect(resolveTerrainPhaseIndex(350, [100, 200, 50])).toBe(0);
  });

  test("builds ping-pong terrain frame orders from the available variant count", () => {
    expect(buildTerrainPingPongFrameIndices(0)).toEqual([]);
    expect(buildTerrainPingPongFrameIndices(1)).toEqual([0]);
    expect(buildTerrainPingPongFrameIndices(2)).toEqual([0, 1]);
    expect(buildTerrainPingPongFrameIndices(5)).toEqual([
      0, 1, 2, 3, 4, 3, 2, 1,
    ]);
  });

  test("resolves terrain toolbar ticks against a dynamic ping-pong loop", () => {
    const steps = Array.from({ length: 10 }, (_, step) =>
      resolveTerrainPingPongFrameIndex(step, 5),
    );

    expect(steps).toEqual([0, 1, 2, 3, 4, 3, 2, 1, 0, 1]);
  });
});
