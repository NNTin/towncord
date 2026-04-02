/**
 * Wave-offset invariant tests.
 *
 * Each water tile receives a per-tile animation offset computed from its world
 * cell position and the current wall-clock time.  Three overlapping sine waves
 * with incommensurable frequencies create an organic interference pattern that
 * drifts over time.  The output is always 0 or one phase duration, so any two
 * adjacent tiles differ by at most 1 phase — the neighbour-sync constraint is
 * always satisfied regardless of the pattern shape.
 */

import { describe, expect, test } from "vitest";
import { DEFAULT_TERRAIN_ANIMATION_FRAME_MS } from "../contracts";
import {
  computeTerrainWaveOffsetMs,
  resolveTerrainPhaseIndex,
} from "../../../engine/terrain/terrainRenderer";

const PHASE_DURATION = DEFAULT_TERRAIN_ANIMATION_FRAME_MS; // 120 ms
const PHASE_COUNT = 8;
const durationsMs = Array.from({ length: PHASE_COUNT }, () => PHASE_DURATION);

// Helper: resolve the visible phase index for a tile at a given time.
function resolvePhase(nowMs: number, cellX: number, cellY: number): number {
  const offset = computeTerrainWaveOffsetMs(
    cellX,
    cellY,
    nowMs,
    PHASE_DURATION,
  );
  return resolveTerrainPhaseIndex(nowMs + offset, durationsMs);
}

describe("computeTerrainWaveOffsetMs", () => {
  test("returns exactly 0 or one phase duration for any position and time", () => {
    const times = [0, 100, 500, 1000, 5000, 10000];
    const coords = [
      [0, 0],
      [1, 0],
      [0, 1],
      [15, 15],
      [31, 0],
      [32, 0],
    ];
    for (const nowMs of times) {
      for (const [cellX, cellY] of coords) {
        const offset = computeTerrainWaveOffsetMs(
          cellX!,
          cellY!,
          nowMs,
          PHASE_DURATION,
        );
        expect(offset === 0 || offset === PHASE_DURATION).toBe(true);
      }
    }
  });

  test("output changes over time (pattern drifts)", () => {
    // Over a 10-second window, at least one tile should change its offset.
    let changesObserved = 0;
    const prevOffsets = new Map<string, number>();

    for (let nowMs = 0; nowMs <= 10000; nowMs += 100) {
      for (let x = 0; x < 4; x += 1) {
        for (let y = 0; y < 4; y += 1) {
          const key = `${x},${y}`;
          const offset = computeTerrainWaveOffsetMs(
            x,
            y,
            nowMs,
            PHASE_DURATION,
          );
          const prev = prevOffsets.get(key);
          if (prev !== undefined && prev !== offset) {
            changesObserved += 1;
          }
          prevOffsets.set(key, offset);
        }
      }
    }

    expect(changesObserved).toBeGreaterThan(0);
  });
});

describe("wave-offset neighbour constraint", () => {
  test("adjacent tiles (horizontal) differ by at most 1 phase at all sampled times", () => {
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      for (let x = 0; x < 8; x += 1) {
        const phaseA = resolvePhase(nowMs, x, 0);
        const phaseB = resolvePhase(nowMs, x + 1, 0);
        const diff = Math.abs(phaseA - phaseB);
        expect(Math.min(diff, PHASE_COUNT - diff)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("adjacent tiles (vertical) differ by at most 1 phase at all sampled times", () => {
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      for (let y = 0; y < 8; y += 1) {
        const phaseA = resolvePhase(nowMs, 0, y);
        const phaseB = resolvePhase(nowMs, 0, y + 1);
        const diff = Math.abs(phaseA - phaseB);
        expect(Math.min(diff, PHASE_COUNT - diff)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("no tile in a 6x6 grid is more than 1 phase from any direct neighbour", () => {
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += Math.floor(PHASE_DURATION / 3)
    ) {
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 6; x += 1) {
          const phase = resolvePhase(nowMs, x, y);
          const neighbours: [number, number][] = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ];
          for (const [nx, ny] of neighbours) {
            const nPhase = resolvePhase(nowMs, nx, ny);
            const diff = Math.abs(phase - nPhase);
            expect(Math.min(diff, PHASE_COUNT - diff)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  test("chunk-boundary tiles obey the same constraint (offset is world-coordinate based)", () => {
    // Tile at x=31 and x=32 are in different chunks but must still be neighbours.
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      const phaseLeft = resolvePhase(nowMs, 31, 0);
      const phaseRight = resolvePhase(nowMs, 32, 0);
      const diff = Math.abs(phaseLeft - phaseRight);
      expect(Math.min(diff, PHASE_COUNT - diff)).toBeLessThanOrEqual(1);
    }
  });
});
