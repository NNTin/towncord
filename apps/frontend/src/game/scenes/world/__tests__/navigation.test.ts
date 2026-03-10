import { describe, expect, test } from "vitest";
import {
  TERRAIN_CHUNK_SIZE,
  TERRAIN_CELL_WORLD_SIZE,
  type TerrainGridSpec,
} from "../../../terrain/contracts";
import { TerrainGameplayGrid } from "../../../terrain/gameplayGrid";
import { TerrainMapStore } from "../../../terrain/store";
import { createGameplayNavigationService } from "../navigation";

function createGrid(rows: string[]): TerrainGameplayGrid {
  const legend = {
    ".": "ground",
    "~": "water",
  } as const;
  const width = rows[0]!.length;
  const height = rows.length;
  const spec: TerrainGridSpec = {
    width,
    height,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: "ground",
    materials: ["ground", "water"],
    cells: rows.flatMap((row) => row.split("").map((glyph) => legend[glyph as keyof typeof legend])),
  };
  return new TerrainGameplayGrid(new TerrainMapStore(spec));
}

describe("navigation", () => {
  test("resolves blocked spawn positions to the nearest walkable cell", () => {
    const grid = createGrid([
      ".....",
      ".~~~.",
      ".....",
    ]);
    const navigation = createGameplayNavigationService(grid);

    const spawn = navigation.resolveSpawnPoint(
      TERRAIN_CELL_WORLD_SIZE * 2 + 4,
      TERRAIN_CELL_WORLD_SIZE * 1 + 8,
    );

    expect(spawn).toEqual({
      x: TERRAIN_CELL_WORLD_SIZE * 2.5,
      y: TERRAIN_CELL_WORLD_SIZE * 0.5,
    });
  });

  test("uses the BFS grid for movement steps", () => {
    const grid = createGrid([
      "..~..",
      "..~..",
      ".....",
    ]);
    const navigation = createGameplayNavigationService(grid);

    const step = navigation.getStepToward(
      {
        position: {
          x: TERRAIN_CELL_WORLD_SIZE * 0.5,
          y: TERRAIN_CELL_WORLD_SIZE * 0.5,
        },
      },
      {
        x: TERRAIN_CELL_WORLD_SIZE * 4.5,
        y: TERRAIN_CELL_WORLD_SIZE * 0.5,
      },
    );

    expect(step.reached).toBe(false);
    expect(Math.abs(step.moveX) + Math.abs(step.moveY)).toBeGreaterThan(0);
  });
});
