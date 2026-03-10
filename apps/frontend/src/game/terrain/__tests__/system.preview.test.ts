import { describe, expect, test } from "vitest";
import { TerrainSystem } from "../system";

function createSceneStub() {
  return {
    cameras: {
      main: {
        worldView: {
          bottom: 720,
          left: 0,
          right: 1280,
          top: 0,
        },
      },
    },
    textures: {
      exists: () => true,
      get: () => ({
        has: () => true,
      }),
    },
  } as const;
}

describe("TerrainSystem previewPaintAtWorld", () => {
  test("returns the four render-grid tiles affected by a placement-grid edit", () => {
    const system = new TerrainSystem(createSceneStub() as never);

    const tiles = system.previewPaintAtWorld(
      {
        type: "terrain",
        materialId: "water",
        brushId: "water",
        screenX: 0,
        screenY: 0,
      },
      64 * 10 + 1,
      64 * 10 + 1,
    );

    expect(tiles?.map(({ cellX, cellY, caseId }) => ({ cellX, cellY, caseId }))).toEqual([
      { cellX: 9, cellY: 9, caseId: 4 },
      { cellX: 10, cellY: 9, caseId: 8 },
      { cellX: 9, cellY: 10, caseId: 2 },
      { cellX: 10, cellY: 10, caseId: 1 },
    ]);
  });

  test("returns null when the hovered world position is outside the terrain bounds", () => {
    const system = new TerrainSystem(createSceneStub() as never);

    const tiles = system.previewPaintAtWorld(
      {
        type: "terrain",
        materialId: "water",
        brushId: "water",
        screenX: 0,
        screenY: 0,
      },
      -1,
      0,
    );

    expect(tiles).toBeNull();
  });
});
