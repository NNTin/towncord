import { describe, expect, test, vi } from "vitest";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_CHUNK_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  type TerrainGridSpec,
} from "../contracts";
import { TerrainRenderer } from "../renderer";

function createGridSpec(): TerrainGridSpec {
  return {
    width: TERRAIN_CHUNK_SIZE,
    height: TERRAIN_CHUNK_SIZE,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: "ground",
    materials: ["ground"],
    cells: Array.from({ length: TERRAIN_CHUNK_SIZE * TERRAIN_CHUNK_SIZE }, () => "ground"),
  };
}

describe("TerrainRenderer render-grid positioning", () => {
  test("offsets chunk render textures onto the dual render grid", () => {
    const renderTexture = {
      setDepth: vi.fn(),
      setOrigin: vi.fn(),
    };
    const scene = {
      add: {
        renderTexture: vi.fn(() => renderTexture),
      },
    };
    const renderer = new TerrainRenderer(scene as never, createGridSpec()) as unknown as Record<
      string,
      unknown
    >;

    (renderer.createRenderTexture as (chunkStartX: number, chunkStartY: number, depth: number) => void)(
      0,
      0,
      -1000,
    );

    expect(scene.add.renderTexture).toHaveBeenCalledWith(
      TERRAIN_RENDER_GRID_WORLD_OFFSET,
      TERRAIN_RENDER_GRID_WORLD_OFFSET,
      TERRAIN_CHUNK_SIZE * TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_CHUNK_SIZE * TERRAIN_CELL_WORLD_SIZE,
    );
  });
});
