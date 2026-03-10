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
  TERRAIN_CELL_WORLD_SIZE: 64,
  TerrainSystem: class {},
}));

type WorldPoint = {
  x: number;
  y: number;
};

function createSceneHarness(input?: {
  entityPositions?: WorldPoint[];
  worldPoint?: WorldPoint;
  worldToCellResult?: { cellX: number; cellY: number } | null;
  cellCenter?: { worldX: number; worldY: number } | null;
}) {
  const scene = new WorldScene() as unknown as Record<string, unknown>;
  const queueDrop = vi.fn();
  const worldPoint = input?.worldPoint ?? { x: 96, y: 96 };
  const worldToCellResult = input?.worldToCellResult;
  const worldToCell = vi.fn((worldX: number, worldY: number) =>
    worldToCellResult === undefined
      ? {
          cellX: Math.floor(worldX / 64),
          cellY: Math.floor(worldY / 64),
        }
      : worldToCellResult,
  );
  const cellToWorldCenter = vi.fn((cellX: number, cellY: number) =>
    input?.cellCenter ?? {
      worldX: cellX * 64 + 32,
      worldY: cellY * 64 + 32,
    },
  );
  const terrainBrushPreview = {
    setFillStyle: vi.fn(),
    setPosition: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
  };

  scene.cameras = {
    main: {
      getWorldPoint: vi.fn(() => worldPoint),
    },
  };
  scene.input = {
    activePointer: {
      withinGame: true,
      x: 12,
      y: 34,
    },
  };
  scene.terrainSystem = {
    getGameplayGrid: () => ({
      worldToCell,
      cellToWorldCenter,
    }),
    queueDrop,
  };
  scene.entities = (input?.entityPositions ?? []).map((position) => ({ position }));
  scene.activeTerrainTool = {
    materialId: "water",
    brushId: "water",
  };
  scene.terrainBrushPreview = terrainBrushPreview;
  scene.terrainPaintSession = new TerrainPaintSession();

  return {
    scene,
    cellToWorldCenter,
    queueDrop,
    terrainBrushPreview,
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

  test("snaps the brush preview to the gameplay placement cell center", () => {
    const { scene, cellToWorldCenter, terrainBrushPreview, worldToCell } = createSceneHarness({
      worldPoint: { x: 100, y: 110 },
      cellCenter: { worldX: 96, worldY: 96 },
    });

    (scene.syncTerrainBrushPreviewAtScreen as (screenX: number, screenY: number) => void)(12, 34);

    expect(worldToCell).toHaveBeenCalledWith(100, 110);
    expect(cellToWorldCenter).toHaveBeenCalledWith(1, 1);
    expect(terrainBrushPreview.setPosition).toHaveBeenCalledWith(96, 96);
    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(true);
  });

  test("hides the brush preview when the hovered placement cell is out of bounds", () => {
    const { scene, terrainBrushPreview } = createSceneHarness({
      worldToCellResult: null,
    });

    (scene.syncTerrainBrushPreviewAtScreen as (screenX: number, screenY: number) => void)(12, 34);

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(terrainBrushPreview.setPosition).not.toHaveBeenCalled();
  });

  test("updates the brush preview on hover even when not actively painting", () => {
    const { scene } = createSceneHarness();
    const syncTerrainBrushPreviewFromPointer = vi.fn();
    const paintTerrainAtScreen = vi.fn();

    scene.syncTerrainBrushPreviewFromPointer = syncTerrainBrushPreviewFromPointer;
    scene.paintTerrainAtScreen = paintTerrainAtScreen;

    (scene.onPointerMove as (pointer: { withinGame: boolean; x: number; y: number }) => void)({
      withinGame: true,
      x: 12,
      y: 34,
    });

    expect(syncTerrainBrushPreviewFromPointer).toHaveBeenCalledWith({
      withinGame: true,
      x: 12,
      y: 34,
    });
    expect(paintTerrainAtScreen).not.toHaveBeenCalled();
  });

  test("hides the brush preview when the pointer is outside the game surface", () => {
    const { scene, terrainBrushPreview } = createSceneHarness();
    const syncTerrainBrushPreviewAtScreen = vi.fn();

    scene.syncTerrainBrushPreviewAtScreen = syncTerrainBrushPreviewAtScreen;

    (
      scene.syncTerrainBrushPreviewFromPointer as (pointer: {
        withinGame: boolean;
        x: number;
        y: number;
      }) => void
    )({
      withinGame: false,
      x: 12,
      y: 34,
    });

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(syncTerrainBrushPreviewAtScreen).not.toHaveBeenCalled();
  });

  test("does not show a stale preview when selecting a brush away from the game surface", () => {
    const { scene, terrainBrushPreview } = createSceneHarness();
    const syncTerrainBrushPreviewAtScreen = vi.fn();

    scene.input = {
      activePointer: {
        withinGame: false,
        x: 12,
        y: 34,
      },
    };
    scene.syncTerrainBrushPreviewAtScreen = syncTerrainBrushPreviewAtScreen;

    (
      scene.onSelectTerrainTool as (tool: {
        materialId: string;
        brushId: string;
      } | null) => void
    )({
      materialId: "water",
      brushId: "water",
    });

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(syncTerrainBrushPreviewAtScreen).not.toHaveBeenCalled();
  });
});
