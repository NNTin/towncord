import { describe, expect, test } from "vitest";
import { TERRAIN_CHUNK_SIZE, TERRAIN_CELL_WORLD_SIZE, type TerrainGridSpec } from "../contracts";
import { TerrainGameplayGrid } from "../gameplayGrid";
import { TerrainMapStore } from "../store";

const WIDTH = 5;
const HEIGHT = 5;

function createGridSpec(rows: string[]): TerrainGridSpec {
  const legend = {
    ".": "ground",
    "~": "water",
  } as const;

  return {
    width: WIDTH,
    height: HEIGHT,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: "ground",
    materials: ["ground", "water"],
    cells: rows.flatMap((row) => row.split("").map((glyph) => legend[glyph as keyof typeof legend])),
  };
}

function createGrid(rows: string[]): { store: TerrainMapStore; grid: TerrainGameplayGrid } {
  const store = new TerrainMapStore(createGridSpec(rows));
  return {
    store,
    grid: new TerrainGameplayGrid(store),
  };
}

describe("TerrainGameplayGrid", () => {
  test("derives world bounds and world/cell conversions from the terrain grid", () => {
    const { grid } = createGrid([
      ".....",
      ".....",
      ".....",
      ".....",
      ".....",
    ]);

    expect(grid.getWorldBounds()).toEqual({
      minX: 0,
      minY: 0,
      maxX: WIDTH * TERRAIN_CELL_WORLD_SIZE - 1,
      maxY: HEIGHT * TERRAIN_CELL_WORLD_SIZE - 1,
      width: WIDTH * TERRAIN_CELL_WORLD_SIZE,
      height: HEIGHT * TERRAIN_CELL_WORLD_SIZE,
    });
    expect(grid.worldToCell(0, 0)).toEqual({ cellX: 0, cellY: 0 });
    expect(grid.worldToCell(TERRAIN_CELL_WORLD_SIZE * 2 + 1, TERRAIN_CELL_WORLD_SIZE * 3 + 7)).toEqual({
      cellX: 2,
      cellY: 3,
    });
    expect(grid.worldToCell(-1, 0)).toBeNull();
    expect(grid.worldToCell(WIDTH * TERRAIN_CELL_WORLD_SIZE, 0)).toBeNull();
    expect(grid.cellToWorldCenter(1, 2)).toEqual({
      worldX: TERRAIN_CELL_WORLD_SIZE * 1.5,
      worldY: TERRAIN_CELL_WORLD_SIZE * 2.5,
    });
    expect(grid.cellToWorldCenter(-1, 0)).toBeNull();
  });

  test("treats water as blocked, ground as walkable, and out-of-bounds as blocked", () => {
    const { grid } = createGrid([
      ".....",
      "..~..",
      ".....",
      ".....",
      ".....",
    ]);

    expect(grid.isCellWalkable(0, 0)).toBe(true);
    expect(grid.isCellWalkable(2, 1)).toBe(false);
    expect(grid.isCellWalkable(-1, 0)).toBe(false);
    expect(grid.isCellWalkable(10, 10)).toBe(false);
  });

  test("finds a BFS path around blocked cells", () => {
    const { grid } = createGrid([
      ".....",
      ".~~~.",
      ".....",
      ".....",
      ".....",
    ]);

    const path = grid.findPath({ cellX: 0, cellY: 0 }, { cellX: 4, cellY: 2 });

    expect(path?.cells).toEqual([
      { cellX: 0, cellY: 0 },
      { cellX: 1, cellY: 0 },
      { cellX: 2, cellY: 0 },
      { cellX: 3, cellY: 0 },
      { cellX: 4, cellY: 0 },
      { cellX: 4, cellY: 1 },
      { cellX: 4, cellY: 2 },
    ]);
    expect(path?.revision).toBe(0);
  });

  test("returns null when start or goal is blocked or out of bounds", () => {
    const { grid } = createGrid([
      ".....",
      "..~..",
      ".....",
      ".....",
      ".....",
    ]);

    expect(grid.findPath({ cellX: 2, cellY: 1 }, { cellX: 4, cellY: 4 })).toBeNull();
    expect(grid.findPath({ cellX: 0, cellY: 0 }, { cellX: 2, cellY: 1 })).toBeNull();
    expect(grid.findPath({ cellX: 0, cellY: 0 }, { cellX: -1, cellY: 0 })).toBeNull();
  });

  test("increments revision only when terrain changes are reported", () => {
    const { store, grid } = createGrid([
      ".....",
      ".....",
      ".....",
      ".....",
      ".....",
    ]);

    grid.notifyCellsChanged([]);
    expect(grid.getRevision()).toBe(0);

    const changed = store.applyEditOp({
      materialId: "water",
      brushId: "water",
      center: { cellX: 2, cellY: 2 },
    });
    expect(changed).toBe(true);

    grid.notifyCellsChanged([{ cellX: 2, cellY: 2 }]);
    expect(grid.getRevision()).toBe(1);
    expect(grid.isCellWalkable(2, 2)).toBe(false);
  });
});
