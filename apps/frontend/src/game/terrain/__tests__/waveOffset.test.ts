/**
 * Wave-offset invariant tests.
 *
 * Water tiles use a checkerboard phase offset: tiles where (cellX + cellY) is
 * odd are shifted by one animation phase relative to even tiles.  This creates
 * a subtle ripple instead of a lock-step flash while guaranteeing that no tile
 * is ever more than 1 phase out of sync with any of its direct neighbours.
 */

import { describe, expect, test } from "vitest";
import { DEFAULT_TERRAIN_ANIMATION_FRAME_MS } from "../contracts";
import { resolveTerrainPhaseIndex } from "../../../engine/terrain/terrainRenderer";

// Helper: compute the phaseOffsetMs that tileResolver assigns to a cell.
function cellPhaseOffsetMs(cellX: number, cellY: number): number {
  return ((cellX + cellY) % 2) * DEFAULT_TERRAIN_ANIMATION_FRAME_MS;
}

// Helper: resolve the phase index for a tile at a given wall-clock time.
function resolvePhase(
  nowMs: number,
  phaseOffsetMs: number,
  durationsMs: number[],
): number {
  return resolveTerrainPhaseIndex(nowMs + phaseOffsetMs, durationsMs);
}

describe("water tile wave-offset invariants", () => {
  const PHASE_DURATION = DEFAULT_TERRAIN_ANIMATION_FRAME_MS; // 120 ms
  const PHASE_COUNT = 8;
  const durationsMs = Array.from({ length: PHASE_COUNT }, () => PHASE_DURATION);

  test("even cells (cellX+cellY even) have phaseOffsetMs = 0", () => {
    expect(cellPhaseOffsetMs(0, 0)).toBe(0);
    expect(cellPhaseOffsetMs(1, 1)).toBe(0);
    expect(cellPhaseOffsetMs(2, 4)).toBe(0);
    expect(cellPhaseOffsetMs(10, 20)).toBe(0);
  });

  test("odd cells (cellX+cellY odd) have phaseOffsetMs = one phase duration", () => {
    expect(cellPhaseOffsetMs(0, 1)).toBe(PHASE_DURATION);
    expect(cellPhaseOffsetMs(1, 0)).toBe(PHASE_DURATION);
    expect(cellPhaseOffsetMs(3, 4)).toBe(PHASE_DURATION);
    expect(cellPhaseOffsetMs(9, 20)).toBe(PHASE_DURATION);
  });

  test("adjacent tiles (horizontal neighbours) differ by exactly 1 phase", () => {
    // Sample several wall-clock times across a full cycle.
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      const phaseEven = resolvePhase(
        nowMs,
        cellPhaseOffsetMs(0, 0),
        durationsMs,
      );
      const phaseOdd = resolvePhase(
        nowMs,
        cellPhaseOffsetMs(1, 0),
        durationsMs,
      );
      const diff = Math.abs(phaseEven - phaseOdd);
      // diff is either 1 or (PHASE_COUNT - 1) at the wrap boundary.
      const normalised = Math.min(diff, PHASE_COUNT - diff);
      expect(normalised).toBe(1);
    }
  });

  test("adjacent tiles (vertical neighbours) differ by exactly 1 phase", () => {
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      const phaseEven = resolvePhase(
        nowMs,
        cellPhaseOffsetMs(0, 0),
        durationsMs,
      );
      const phaseOdd = resolvePhase(
        nowMs,
        cellPhaseOffsetMs(0, 1),
        durationsMs,
      );
      const diff = Math.abs(phaseEven - phaseOdd);
      const normalised = Math.min(diff, PHASE_COUNT - diff);
      expect(normalised).toBe(1);
    }
  });

  test("diagonal neighbours (same parity) are always in the same phase", () => {
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      const phaseA = resolvePhase(nowMs, cellPhaseOffsetMs(0, 0), durationsMs);
      const phaseB = resolvePhase(nowMs, cellPhaseOffsetMs(1, 1), durationsMs);
      expect(phaseA).toBe(phaseB);
    }
  });

  test("no tile is more than 1 phase out of sync with any direct neighbour", () => {
    // Test a 5x5 grid at multiple points in time.
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += Math.floor(PHASE_DURATION / 3)
    ) {
      for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 5; x += 1) {
          const phase = resolvePhase(
            nowMs,
            cellPhaseOffsetMs(x, y),
            durationsMs,
          );
          const neighbours: [number, number][] = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ];
          for (const [nx, ny] of neighbours) {
            const nPhase = resolvePhase(
              nowMs,
              cellPhaseOffsetMs(nx, ny),
              durationsMs,
            );
            const diff = Math.abs(phase - nPhase);
            const normalised = Math.min(diff, PHASE_COUNT - diff);
            expect(normalised).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  test("chunk-boundary tiles are in sync with their cross-chunk neighbours", () => {
    // Tiles at x=31 (last in chunk 0) and x=32 (first in chunk 1) must obey
    // the same checkerboard rule, because phaseOffsetMs is based on world
    // cell coordinates, not chunk-local coordinates.
    const chunkBoundaryLeft = { cellX: 31, cellY: 0 };
    const chunkBoundaryRight = { cellX: 32, cellY: 0 };

    const offsetLeft = cellPhaseOffsetMs(
      chunkBoundaryLeft.cellX,
      chunkBoundaryLeft.cellY,
    );
    const offsetRight = cellPhaseOffsetMs(
      chunkBoundaryRight.cellX,
      chunkBoundaryRight.cellY,
    );

    // (31 + 0) % 2 = 1 → offset = PHASE_DURATION
    // (32 + 0) % 2 = 0 → offset = 0
    expect(offsetLeft).toBe(PHASE_DURATION);
    expect(offsetRight).toBe(0);

    // They differ by exactly 1 phase at all times (adjacent tiles invariant holds).
    for (
      let nowMs = 0;
      nowMs < PHASE_DURATION * PHASE_COUNT;
      nowMs += PHASE_DURATION
    ) {
      const phaseLeft = resolvePhase(nowMs, offsetLeft, durationsMs);
      const phaseRight = resolvePhase(nowMs, offsetRight, durationsMs);
      const diff = Math.abs(phaseLeft - phaseRight);
      const normalised = Math.min(diff, PHASE_COUNT - diff);
      expect(normalised).toBe(1);
    }
  });
});
