/**
 * Pixel-seam invariant tests for terrain chunk render textures.
 *
 * Adjacent RenderTexture chunks must share boundaries at integer world
 * coordinates.  If any chunk's top-left world position is fractional, the
 * GPU maps the boundary between chunks to a fractional screen pixel (even at
 * integer zoom), producing a thin seam through the terrain.
 *
 * The position formula used by TerrainRenderer.createRenderTexture is:
 *   worldX = chunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET
 *
 * Both TERRAIN_CELL_WORLD_SIZE and TERRAIN_RENDER_GRID_WORLD_OFFSET must be
 * integers, and the arithmetic must never produce a fractional result.
 */

import { describe, expect, test } from "vitest";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_CHUNK_SIZE,
} from "../contracts";

describe("terrain pixel-seam invariants", () => {
  test("TERRAIN_CELL_WORLD_SIZE is a positive integer", () => {
    expect(Number.isInteger(TERRAIN_CELL_WORLD_SIZE)).toBe(true);
    expect(TERRAIN_CELL_WORLD_SIZE).toBeGreaterThan(0);
  });

  test("TERRAIN_RENDER_GRID_WORLD_OFFSET is a non-negative integer", () => {
    // The offset is TERRAIN_CELL_WORLD_SIZE * 0.5. With TERRAIN_CELL_WORLD_SIZE
    // being an even number this resolves to an integer, keeping all RT
    // world-space positions on the pixel grid.
    expect(Number.isInteger(TERRAIN_RENDER_GRID_WORLD_OFFSET)).toBe(true);
    expect(TERRAIN_RENDER_GRID_WORLD_OFFSET).toBeGreaterThanOrEqual(0);
  });

  test("chunk RT world-X is always an integer for all valid chunkStartX values", () => {
    // chunkStartX = chunkX * TERRAIN_CHUNK_SIZE
    // worldX = chunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET
    for (let chunkX = 0; chunkX < 8; chunkX += 1) {
      const chunkStartX = chunkX * TERRAIN_CHUNK_SIZE;
      const worldX = chunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET;
      expect(Number.isInteger(worldX)).toBe(true);
    }
  });

  test("chunk RT world-Y is always an integer for all valid chunkStartY values", () => {
    for (let chunkY = 0; chunkY < 8; chunkY += 1) {
      const chunkStartY = chunkY * TERRAIN_CHUNK_SIZE;
      const worldY = chunkStartY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET;
      expect(Number.isInteger(worldY)).toBe(true);
    }
  });

  test("adjacent chunk RT boundaries share the same integer world-X coordinate", () => {
    // chunk N ends at  chunkStart_N * cellSize + chunkSize * cellSize + offset
    // chunk N+1 starts at (chunkStart_N + chunkSize) * cellSize + offset
    // These must be equal (perfect contiguity) and integer.
    for (let chunkX = 0; chunkX < 4; chunkX += 1) {
      const chunkStartX = chunkX * TERRAIN_CHUNK_SIZE;
      const nextChunkStartX = (chunkX + 1) * TERRAIN_CHUNK_SIZE;

      const currentRTLeft = chunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET;
      const currentRTRight = currentRTLeft + TERRAIN_CHUNK_SIZE * TERRAIN_CELL_WORLD_SIZE;
      const nextRTLeft = nextChunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET;

      expect(currentRTRight).toBe(nextRTLeft);
      expect(Number.isInteger(currentRTRight)).toBe(true);
    }
  });

  test("tile draw position within RT is always an integer (localCellX * size + size * 0.5)", () => {
    // Tiles are drawn at localCellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5
    // inside the RT. The RT is a single texture so seams between cells within
    // the RT are impossible, but integer positions ensure clean pixel alignment.
    for (let localCellX = 0; localCellX < TERRAIN_CHUNK_SIZE; localCellX += 1) {
      const drawX = localCellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5;
      expect(Number.isInteger(drawX)).toBe(true);
    }
  });
});
