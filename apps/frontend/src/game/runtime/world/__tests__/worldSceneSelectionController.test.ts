import { describe, expect, test, vi } from "vitest";
import { WorldSceneSelectionController } from "../worldSceneSelectionController";

function createSelectionHarness() {
  const badge = {
    setDepth: vi.fn(),
    setPosition: vi.fn(),
    setScale: vi.fn(),
    setVisible: vi.fn(),
  };
  const entitySystem = {
    findBySpriteTarget: vi.fn((target: unknown) =>
      target === "hit-entity"
        ? ({
            position: { x: 128, y: 192 },
            sprite: { displayHeight: 96 },
          } as never)
        : null,
    ),
    getSelected: vi.fn(() => null),
    select: vi.fn(),
  };
  const terrainInspection = {
    textureKey: "debug.tilesets",
    frame: "terrain.grass",
    cellX: 2,
    cellY: 3,
    materialId: "grass",
    caseId: 1,
    rotate90: 0 as const,
    flipX: false,
    flipY: false,
  };
  const scene = {
    add: {
      sprite: vi.fn(() => badge),
    },
    anims: {
      get: vi.fn(() => ({
        frames: [
          {
            textureKey: "debug",
            textureFrame: "badge",
          },
        ],
      })),
    },
    input: {
      hitTestPointer: vi.fn(() => ["miss", "hit-entity"]),
      sortGameObjects: vi.fn((targets: unknown[]) => targets),
    },
    cameras: {
      main: {
        getWorldPoint: vi.fn(() => ({ x: 64, y: 96 })),
      },
    },
  };
  const emitTerrainTileInspected = vi.fn();
  const controller = new WorldSceneSelectionController(
    {
      scene: scene as never,
      getEntitySystem: () => entitySystem as never,
      getTerrainRuntime: () =>
        ({
          inspectAtWorld: vi.fn(() => terrainInspection),
        }) as never,
    },
    {
      emitTerrainTileInspected,
    } as never,
  );

  controller.createSelectionBadge();

  return {
    badge,
    controller,
    emitTerrainTileInspected,
    entitySystem,
    scene,
    terrainInspection,
  };
}

describe("WorldSceneSelectionController", () => {
  test("positions the selection badge above the anchored sprite top edge", () => {
    const { badge, controller } = createSelectionHarness();

    controller.syncSelectionBadgePosition({
      position: { x: 128, y: 192 },
      sprite: { displayHeight: 96 },
    } as never);

    expect(badge.setPosition).toHaveBeenCalledWith(128, 117);
  });

  test("selects the first matching entity hit and emits terrain inspection", () => {
    const {
      controller,
      emitTerrainTileInspected,
      entitySystem,
      terrainInspection,
    } = createSelectionHarness();

    controller.handleSelectionAndInspect({
      x: 12,
      y: 34,
    } as never);

    expect(entitySystem.select).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 128, y: 192 },
      }),
    );
    expect(emitTerrainTileInspected).toHaveBeenCalledWith(terrainInspection);
  });
});
