import { describe, expect, test, vi } from "vitest";
import { WorldScene } from "../../WorldScene";
import { TerrainPaintSession } from "../terrainPaintSession";

vi.mock("phaser", () => {
  class Scene {
    constructor(_key?: string) {}
  }

  return {
    default: {
      Scene,
      Input: {
        Keyboard: {
          KeyCodes: {
            SHIFT: 16,
          },
        },
      },
      Math: {
        Clamp(value: number, min: number, max: number) {
          return Math.min(Math.max(value, min), max);
        },
      },
    },
  };
});

vi.mock("../../../terrain", () => ({
  TerrainSystem: class {},
}));

type WorldPoint = {
  x: number;
  y: number;
};

function createSceneHarness(input?: {
  entityPositions?: WorldPoint[];
  worldPoint?: WorldPoint;
}) {
  const scene = new WorldScene() as unknown as Record<string, unknown>;
  const queueDrop = vi.fn();
  const worldPoint = input?.worldPoint ?? { x: 96, y: 96 };
  const worldToCell = vi.fn((worldX: number, worldY: number) => ({
    cellX: Math.floor(worldX / 64),
    cellY: Math.floor(worldY / 64),
  }));

  scene.cameras = {
    main: {
      getWorldPoint: vi.fn(() => worldPoint),
    },
  };
  scene.terrainSystem = {
    getGameplayGrid: () => ({
      worldToCell,
    }),
    queueDrop,
  };
  scene.entities = (input?.entityPositions ?? []).map((position) => ({ position }));
  scene.activeTerrainTool = {
    materialId: "water",
    brushId: "water",
  };
  scene.terrainPaintSession = new TerrainPaintSession();

  return {
    scene,
    queueDrop,
    worldToCell,
  };
}

describe("WorldScene terrain painting", () => {
  test("does not queue brush paint when the target cell is occupied", () => {
    const { scene, queueDrop } = createSceneHarness({
      entityPositions: [{ x: 96, y: 96 }],
    });

    (scene.terrainPaintSession as TerrainPaintSession).begin();
    (scene.paintTerrainAtScreen as (screenX: number, screenY: number) => void)(12, 34);

    expect(queueDrop).not.toHaveBeenCalled();
  });

  test("occupied cells are not marked as painted for the rest of the stroke", () => {
    const { scene, queueDrop } = createSceneHarness({
      entityPositions: [{ x: 96, y: 96 }],
    });

    (scene.terrainPaintSession as TerrainPaintSession).begin();
    (scene.paintTerrainAtScreen as (screenX: number, screenY: number) => void)(12, 34);
    scene.entities = [];
    (scene.paintTerrainAtScreen as (screenX: number, screenY: number) => void)(12, 34);

    expect(queueDrop).toHaveBeenCalledOnce();
  });

  test("drop-based terrain edits also skip occupied cells", () => {
    const { scene, queueDrop } = createSceneHarness({
      entityPositions: [{ x: 96, y: 96 }],
    });

    (
      scene.onPlaceTerrainDrop as (payload: {
        type: "terrain";
        materialId: string;
        brushId: string;
        screenX: number;
        screenY: number;
      }) => void
    )({
      type: "terrain",
      materialId: "water",
      brushId: "water",
      screenX: 12,
      screenY: 34,
    });

    expect(queueDrop).not.toHaveBeenCalled();
  });
});
