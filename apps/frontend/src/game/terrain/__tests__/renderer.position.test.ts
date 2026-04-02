import { describe, expect, test, vi } from "vitest";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_CHUNK_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  type TerrainGridSpec,
} from "../contracts";
import { TerrainRenderer } from "../../../engine/terrain/terrainRenderer";

function createGridSpec(): TerrainGridSpec {
  return {
    width: TERRAIN_CHUNK_SIZE,
    height: TERRAIN_CHUNK_SIZE,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: "ground",
    materials: ["ground"],
    cells: Array.from(
      { length: TERRAIN_CHUNK_SIZE * TERRAIN_CHUNK_SIZE },
      () => "ground",
    ),
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
    const renderer = new TerrainRenderer(
      scene as never,
      createGridSpec(),
    ) as unknown as Record<string, unknown>;

    (
      renderer.createRenderTexture as (
        chunkStartX: number,
        chunkStartY: number,
        depth: number,
      ) => void
    )(0, 0, -1000);

    expect(scene.add.renderTexture).toHaveBeenCalledWith(
      TERRAIN_RENDER_GRID_WORLD_OFFSET,
      TERRAIN_RENDER_GRID_WORLD_OFFSET,
      TERRAIN_CHUNK_SIZE * TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_CHUNK_SIZE * TERRAIN_CELL_WORLD_SIZE,
    );
  });

  test("draws tile underlays before transparent overlay frames", () => {
    const renderTexture = {
      batchDraw: vi.fn(),
      beginDraw: vi.fn(),
      clear: vi.fn(),
      destroy: vi.fn(),
      endDraw: vi.fn(),
      setDepth: vi.fn(),
      setOrigin: vi.fn(),
      setVisible: vi.fn(),
    };
    const scratchImage = {
      setTexture: vi.fn(),
      setScale: vi.fn(),
      setRotation: vi.fn(),
      setFlip: vi.fn(),
      setPosition: vi.fn(),
      destroy: vi.fn(),
      width: 16,
    };
    const scene = {
      add: {
        renderTexture: vi.fn(() => renderTexture),
      },
      make: {
        image: vi.fn(() => scratchImage),
      },
      textures: {
        get: vi.fn(() => ({
          has: () => true,
        })),
      },
      time: {
        now: 0,
      },
    };
    const renderer = new TerrainRenderer(
      scene as never,
      createGridSpec(),
      "farmrpg.tilesets",
    );

    renderer.applyChunkPayload({
      id: "0,0",
      chunkX: 0,
      chunkY: 0,
      revision: 1,
      tiles: [
        {
          cellX: 0,
          cellY: 0,
          caseId: 15,
          underlayFrame: "tilesets.farmrpg.water.tile#0",
          frame: "tilesets.farmrpg.grass-water.spring#15",
          rotate90: 0,
          flipX: false,
          flipY: false,
        },
      ],
    });

    expect(scratchImage.setTexture).toHaveBeenNthCalledWith(
      1,
      "farmrpg.tilesets",
      "tilesets.farmrpg.water.tile#0@0",
    );
    expect(scratchImage.setTexture).toHaveBeenNthCalledWith(
      2,
      "farmrpg.tilesets",
      "tilesets.farmrpg.grass-water.spring#15@0",
    );
    expect(renderTexture.batchDraw).toHaveBeenCalledTimes(2);
  });
});
