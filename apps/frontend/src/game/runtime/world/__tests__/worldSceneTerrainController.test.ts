import { describe, expect, test, vi } from "vitest";
import { WorldSceneTerrainController } from "../worldSceneTerrainController";

vi.mock("../../../../engine", () => ({
  TERRAIN_CELL_WORLD_SIZE: 64,
  TERRAIN_RENDER_GRID_WORLD_OFFSET: 32,
  TERRAIN_TEXTURE_KEY: "debug.tilesets",
}));

type WorldPoint = {
  x: number;
  y: number;
};

const OCCUPIED_ENTITY_POSITIONS: WorldPoint[] = [{ x: 96, y: 96 }];

function createHarness(input?: {
  entityPositions?: WorldPoint[];
  runtimeTextureKey?: string;
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
  const queueDrop = vi.fn();
  const previewPaintAtWorld = vi.fn(() => input?.previewTiles ?? []);
  const setTerrainContentSource = vi.fn();
  const runtimeTextureKey = input?.runtimeTextureKey ?? "debug.tilesets";
  const worldPoint = input?.worldPoint ?? { x: 96, y: 96 };
  const worldToCellResult = input?.worldToCellResult;
  const entityPositions = [...(input?.entityPositions ?? [])];
  const worldToCell = vi.fn((worldX: number, worldY: number) =>
    worldToCellResult === undefined
      ? {
          cellX: Math.floor(worldX / 64),
          cellY: Math.floor(worldY / 64),
        }
      : worldToCellResult,
  );
  const terrainBrushPreview = {
    setDepth: vi.fn(),
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
  };
  const previewImage = {
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
  const scene = {
    add: {
      image: vi.fn(() => previewImage),
      rectangle: vi.fn(() => terrainBrushPreview),
    },
    cameras: {
      main: {
        getWorldPoint: vi.fn(() => worldPoint),
      },
    },
    input: {
      activePointer: {
        withinGame: true,
        x: 12,
        y: 34,
      },
    },
  };
  const controller = new WorldSceneTerrainController({
    scene: scene as never,
    getTerrainRuntime: () =>
      ({
        getGameplayGrid: () => ({
          worldToCell,
        }),
        getTextureKey: () => runtimeTextureKey,
        previewPaintAtWorld,
        queueDrop,
      }) as never,
    getEntities: () =>
      entityPositions.map((position) => ({
        position,
      })) as never,
    setTerrainContentSource,
  });

  controller.createBrushPreview();
  controller.handleSelectTerrainTool({
    materialId: "water",
    brushId: "water",
  });

  return {
    controller,
    entityPositions,
    previewImage,
    previewPaintAtWorld,
    queueDrop,
    scene,
    setTerrainContentSource,
    terrainBrushPreview,
    worldToCell,
  };
}

describe("WorldSceneTerrainController", () => {
  test("creates the brush preview with a top-left origin", () => {
    const { scene, terrainBrushPreview } = createHarness();

    expect(scene.add.rectangle).toHaveBeenCalledOnce();
    expect(terrainBrushPreview.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  test("does not queue brush paint when the target cell is occupied", () => {
    const { controller, queueDrop } = createHarness({
      entityPositions: OCCUPIED_ENTITY_POSITIONS,
    });

    controller.beginPainting({
      x: 12,
      y: 34,
    } as never);

    expect(queueDrop).not.toHaveBeenCalled();
  });

  test("occupied cells are not marked as painted for the rest of the stroke", () => {
    const { controller, entityPositions, queueDrop } = createHarness({
      entityPositions: OCCUPIED_ENTITY_POSITIONS,
    });

    controller.beginPainting({
      x: 12,
      y: 34,
    } as never);
    entityPositions.length = 0;
    controller.paintAtScreen(12, 34);

    expect(queueDrop).toHaveBeenCalledOnce();
  });

  test("drop-based terrain edits also skip occupied cells", () => {
    const { controller, queueDrop } = createHarness({
      entityPositions: OCCUPIED_ENTITY_POSITIONS,
    });

    controller.handlePlaceTerrainDrop({
      type: "terrain",
      materialId: "water",
      brushId: "water",
      screenX: 12,
      screenY: 34,
    });

    expect(queueDrop).not.toHaveBeenCalled();
  });

  test("snaps the brush preview to the gameplay placement grid anchor", () => {
    const { controller, terrainBrushPreview, worldToCell } = createHarness({
      worldPoint: { x: 100, y: 110 },
    });

    controller.syncPreviewAtScreen(12, 34);

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
    const { controller, previewPaintAtWorld } = createHarness({
      previewTiles,
      worldPoint: { x: 96, y: 96 },
    });
    const syncRenderPreviewTiles = vi.spyOn(
      controller,
      "syncRenderPreviewTiles",
    );

    controller.syncPreviewAtScreen(12, 34);

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
    expect(syncRenderPreviewTiles).toHaveBeenCalledWith(previewTiles);
  });

  test("positions resolved render-tile preview images on the shifted render grid", () => {
    const { controller, previewImage } = createHarness();

    controller.syncRenderPreviewTiles([
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

    expect(previewImage.setPosition).toHaveBeenCalledWith(128, 128);
  });

  test("uses the active terrain runtime texture for render preview images", () => {
    const { controller, previewImage } = createHarness({
      runtimeTextureKey: "farmrpg.tilesets",
    });

    controller.syncRenderPreviewTiles([
      {
        cellX: 1,
        cellY: 1,
        caseId: 1,
        frame: "tilesets.farmrpg.environment.grass#1",
        rotate90: 0,
        flipX: false,
        flipY: false,
      },
    ]);

    expect(previewImage.setTexture).toHaveBeenCalledWith(
      "farmrpg.tilesets",
      "tilesets.farmrpg.environment.grass#1",
    );
  });

  test("switches the active terrain content source when a terrain tool declares one", () => {
    const { controller, setTerrainContentSource } = createHarness();

    controller.handleSelectTerrainTool({
      materialId: "water",
      brushId: "water",
      terrainSourceId: "public-assets:terrain/farmrpg-grass",
    });

    expect(setTerrainContentSource).toHaveBeenCalledWith(
      "public-assets:terrain/farmrpg-grass",
    );
  });

  test("hides the brush preview when the hovered placement cell is out of bounds", () => {
    const { controller, terrainBrushPreview } = createHarness({
      worldToCellResult: null,
    });

    controller.syncPreviewAtScreen(12, 34);

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
    expect(terrainBrushPreview.setPosition).not.toHaveBeenCalled();
  });

  test("hides the brush preview when the pointer is outside the game surface", () => {
    const { controller, scene, terrainBrushPreview } = createHarness();

    scene.input.activePointer.withinGame = false;
    controller.syncPreviewFromPointer(scene.input.activePointer as never);

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
  });

  test("does not show a stale preview when selecting a brush away from the game surface", () => {
    const { controller, scene, terrainBrushPreview } = createHarness();

    scene.input.activePointer.withinGame = false;
    controller.handleSelectTerrainTool({
      materialId: "water",
      brushId: "water",
    });

    expect(terrainBrushPreview.setVisible).toHaveBeenCalledWith(false);
  });
});
