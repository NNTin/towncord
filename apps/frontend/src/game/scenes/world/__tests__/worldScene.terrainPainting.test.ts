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
  TERRAIN_RENDER_GRID_WORLD_OFFSET: 32,
  TERRAIN_TEXTURE_KEY: "debug.tilesets",
  TerrainSystem: class {},
}));

type WorldPoint = {
  x: number;
  y: number;
};

const OCCUPIED_ENTITY_POSITIONS: WorldPoint[] = [{ x: 96, y: 96 }];

function createSceneHarness(input?: {
  entityPositions?: WorldPoint[];
  worldPoint?: WorldPoint;
  worldToCellResult?: { cellX: number; cellY: number } | null;
  previewTiles?: Array<{
    cellX: number;
    cellY: number;
    caseId: number;
    frame: string;
    rotate90: 0 | 1 | 2 | 3;
    flipX: boolean;
    flipY: boolean;
  }> | null;
}) {
  const scene = new WorldScene() as unknown as Record<string, unknown>;
  const queueDrop = vi.fn();
  const previewPaintAtWorld = vi.fn(() => input?.previewTiles ?? []);
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
    }),
    previewPaintAtWorld,
    queueDrop,
  };
  scene.entities = (input?.entityPositions ?? []).map((position) => ({
    position,
  }));
  scene.activeTerrainTool = {
    materialId: "water",
    brushId: "water",
  };
  scene.terrainBrushPreview = terrainBrushPreview;
  scene.terrainPaintSession = new TerrainPaintSession();

  return {
    previewPaintAtWorld,
    scene,
    queueDrop,
    terrainBrushPreview,
    worldToCell,
  };
}

function createOccupiedSceneHarness() {
  return createSceneHarness({
    entityPositions: OCCUPIED_ENTITY_POSITIONS,
  });
}

function paintTerrainAtPointer(scene: Record<string, unknown>): void {
  (scene.paintTerrainAtScreen as (screenX: number, screenY: number) => void)(
    12,
    34,
  );
}

function beginBrushPaint(scene: Record<string, unknown>): void {
  (scene.terrainPaintSession as TerrainPaintSession).begin();
  paintTerrainAtPointer(scene);
}

describe("WorldScene terrain painting", () => {
  test("positions the selection badge above the anchored sprite top edge", () => {
    const scene = new WorldScene() as unknown as Record<string, unknown>;
    const selectionBadge = {
      setPosition: vi.fn(),
    };

    scene.selectionBadge = selectionBadge;

    (
      scene.syncSelectionBadgePosition as (entity: {
        position: { x: number; y: number };
        sprite: { displayHeight: number };
      }) => void
    )({
      position: { x: 128, y: 192 },
      sprite: { displayHeight: 96 },
    });

    expect(selectionBadge.setPosition).toHaveBeenCalledWith(128, 108);
  });

  test("creates the brush preview with a top-left origin", () => {
    const scene = new WorldScene() as unknown as Record<string, unknown>;
    const preview = {
      setDepth: vi.fn(),
      setOrigin: vi.fn(),
      setStrokeStyle: vi.fn(),
      setVisible: vi.fn(),
    };

    scene.add = {
      rectangle: vi.fn(() => preview),
    };

    (scene.createTerrainBrushPreview as () => void)();

    expect(preview.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  test("does not queue brush paint when the target cell is occupied", () => {
    const { scene, queueDrop } = createOccupiedSceneHarness();
    beginBrushPaint(scene);

    expect(queueDrop).not.toHaveBeenCalled();
  });

  test("occupied cells are not marked as painted for the rest of the stroke", () => {
    const { scene, queueDrop } = createOccupiedSceneHarness();
    beginBrushPaint(scene);
    scene.entities = [];
    paintTerrainAtPointer(scene);

    expect(queueDrop).toHaveBeenCalledOnce();
  });

  test("drop-based terrain edits also skip occupied cells", () => {
    const { scene, queueDrop } = createOccupiedSceneHarness();

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

  test("snaps the brush preview to the gameplay placement grid anchor", () => {
    const { scene, terrainBrushPreview, worldToCell } = createSceneHarness({
      worldPoint: { x: 100, y: 110 },
    });

    (
      scene.syncTerrainBrushPreviewAtScreen as (
        screenX: number,
        screenY: number,
      ) => void
    )(12, 34);

    expect(worldToCell).toHaveBeenCalledWith(100, 110);
    expect(terrainBrushPreview.setPosition).toHaveBeenCalledWith(64, 64);
    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(true);
  });

  test("syncs the resolved render-tile preview for the hovered placement edit", () => {
    const previewTiles = [
      {
        cellX: 1,
        cellY: 1,
        caseId: 1,
        frame: "tilesets.debug.environment.autotile-15#1",
        rotate90: 0 as const,
        flipX: false,
        flipY: false,
      },
    ];
    const { previewPaintAtWorld, scene } = createSceneHarness({
      previewTiles,
      worldPoint: { x: 96, y: 96 },
    });
    const syncTerrainBrushRenderPreviewTiles = vi.fn();

    scene.syncTerrainBrushRenderPreviewTiles =
      syncTerrainBrushRenderPreviewTiles;

    (
      scene.syncTerrainBrushPreviewAtScreen as (
        screenX: number,
        screenY: number,
      ) => void
    )(12, 34);

    expect(previewPaintAtWorld).toHaveBeenCalledWith(
      {
        type: "terrain",
        materialId: "water",
        brushId: "water",
        screenX: 12,
        screenY: 34,
      },
      96,
      96,
    );
    expect(syncTerrainBrushRenderPreviewTiles).toHaveBeenCalledWith(
      previewTiles,
    );
  });

  test("positions resolved render-tile preview images on the shifted render grid", () => {
    const scene = new WorldScene() as unknown as Record<string, unknown>;
    const image = {
      setAlpha: vi.fn(),
      setDepth: vi.fn(),
      setFlip: vi.fn(),
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setScale: vi.fn(),
      setTexture: vi.fn(),
      setVisible: vi.fn(),
      width: 16,
    };

    scene.add = {
      image: vi.fn(() => image),
    };
    scene.terrainBrushRenderPreviewImages = [];

    (
      scene.syncTerrainBrushRenderPreviewTiles as (
        tiles: Array<{
          cellX: number;
          cellY: number;
          caseId: number;
          frame: string;
          rotate90: 0 | 1 | 2 | 3;
          flipX: boolean;
          flipY: boolean;
        }>,
      ) => void
    )([
      {
        cellX: 1,
        cellY: 1,
        caseId: 1,
        frame: "tilesets.debug.environment.autotile-15#1",
        rotate90: 0,
        flipX: false,
        flipY: false,
      },
    ]);

    expect(image.setPosition).toHaveBeenCalledWith(128, 128);
  });

  test("hides the brush preview when the hovered placement cell is out of bounds", () => {
    const { scene, terrainBrushPreview } = createSceneHarness({
      worldToCellResult: null,
    });

    (
      scene.syncTerrainBrushPreviewAtScreen as (
        screenX: number,
        screenY: number,
      ) => void
    )(12, 34);

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(terrainBrushPreview.setPosition).not.toHaveBeenCalled();
  });

  test("updates the brush preview on hover even when not actively painting", () => {
    const { scene } = createSceneHarness();
    const syncTerrainBrushPreviewFromPointer = vi.fn();
    const paintTerrainAtScreen = vi.fn();

    scene.syncTerrainBrushPreviewFromPointer =
      syncTerrainBrushPreviewFromPointer;
    scene.paintTerrainAtScreen = paintTerrainAtScreen;

    (
      scene.onPointerMove as (pointer: {
        withinGame: boolean;
        x: number;
        y: number;
      }) => void
    )({
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
      scene.onSelectTerrainTool as (
        tool: {
          materialId: string;
          brushId: string;
        } | null,
      ) => void
    )({
      materialId: "water",
      brushId: "water",
    });

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(syncTerrainBrushPreviewAtScreen).not.toHaveBeenCalled();
  });
});
