import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../transport/runtimeEvents";
import { WorldScenePlacementController } from "../worldScenePlacementController";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

describe("WorldScenePlacementController", () => {
  test("places a player, selects it, and emits the player placement projection", () => {
    const emit = vi.fn();
    const addEntity = vi.fn(() => ({
      id: 1,
      position: { x: 96, y: 160 },
    }));
    const selectEntity = vi.fn();
    const controller = new WorldScenePlacementController(
      {
        getEntityRegistry: () =>
          ({
            getRuntimeById: () => ({
              definition: {
                kind: "player",
                placeable: true,
              },
            }),
          }) as never,
        getTerrainRuntime: () =>
          ({
            getGameplayGrid: () => ({
              clampWorldPoint: () => ({
                worldX: 96,
                worldY: 160,
              }),
              isWorldWalkable: () => true,
            }),
          }) as never,
        getEntitySystem: () =>
          ({
            addEntity,
          }) as never,
        getWorldPoint: () => ({
          x: 100,
          y: 160,
        }),
        selectEntity,
        getBarnPostsCellQuery: () => null,
        createMobNavigation: () => null,
      },
      new WorldSceneProjectionEmitter({
        getRuntimeHost: () => ({
          events: {
            emit,
            on: vi.fn(),
            off: vi.fn(),
          },
        }),
      }),
    );

    controller.handlePlaceEntityDrop({
      type: "entity",
      entityId: "player",
      screenX: 12,
      screenY: 34,
    });

    expect(addEntity).toHaveBeenCalled();
    expect(selectEntity).toHaveBeenCalledWith({
      id: 1,
      position: { x: 96, y: 160 },
    });
    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.PLAYER_PLACED, {
      worldX: 96,
      worldY: 160,
    });
  });

  test("ignores prop drops in world placement", () => {
    const addEntity = vi.fn();
    const controller = new WorldScenePlacementController(
      {
        getEntityRegistry: () =>
          ({
            getRuntimeById: () => ({
              definition: {
                kind: "prop",
                placeable: true,
              },
            }),
          }) as never,
        getTerrainRuntime: () =>
          ({
            getGameplayGrid: () => ({
              clampWorldPoint: () => ({
                worldX: 96,
                worldY: 160,
              }),
              isWorldWalkable: () => true,
            }),
          }) as never,
        getEntitySystem: () =>
          ({
            addEntity,
          }) as never,
        getWorldPoint: () => ({
          x: 100,
          y: 160,
        }),
        selectEntity: vi.fn(),
        getBarnPostsCellQuery: () => null,
        createMobNavigation: () => null,
      },
      new WorldSceneProjectionEmitter({
        getRuntimeHost: () => ({
          events: {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
          },
        }),
      }),
    );

    controller.handlePlaceEntityDrop({
      type: "entity",
      entityId: "prop.static.set-01.variant-01",
      screenX: 12,
      screenY: 34,
    });

    expect(addEntity).not.toHaveBeenCalled();
  });

  test("handleSpawnMob: spawns npc on a barn.posts walkable cell", () => {
    const emit = vi.fn();
    const addEntity = vi.fn(() => ({ id: 2, position: { x: 48, y: 48 } }));
    const selectEntity = vi.fn();

    const controller = new WorldScenePlacementController(
      {
        getEntityRegistry: () =>
          ({
            getRuntimeById: () => ({
              definition: { kind: "npc", placeable: true },
            }),
          }) as never,
        getTerrainRuntime: () =>
          ({
            getGameplayGrid: () => ({
              isCellWalkable: () => true,
              cellToWorldCenter: (_cellX: number, _cellY: number) => ({
                worldX: 48,
                worldY: 48,
              }),
            }),
          }) as never,
        getEntitySystem: () => ({ addEntity }) as never,
        getWorldPoint: () => ({ x: 0, y: 0 }),
        selectEntity,
        getBarnPostsCellQuery: () => ({
          isBarnPostsCell: (cellX: number, cellY: number) =>
            cellX === 1 && cellY === 1,
          width: 4,
          height: 4,
        }),
        createMobNavigation: () => null,
      },
      new WorldSceneProjectionEmitter({
        getRuntimeHost: () => ({
          events: {
            emit,
            on: vi.fn(),
            off: vi.fn(),
          },
        }),
      }),
    );

    controller.handleSpawnMob({ entityId: "npc.animals.chicken" });

    expect(addEntity).toHaveBeenCalledWith(
      expect.anything(),
      48,
      48,
      expect.anything(),
    );
    expect(selectEntity).toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith(
      RUNTIME_TO_UI_EVENTS.MOB_SPAWN_FAILED,
      expect.anything(),
    );
  });

  test("handleSpawnMob: emits MOB_SPAWN_FAILED when no barn.posts cells exist", () => {
    const emit = vi.fn();
    const addEntity = vi.fn();

    const controller = new WorldScenePlacementController(
      {
        getEntityRegistry: () =>
          ({
            getRuntimeById: () => ({
              definition: { kind: "npc", placeable: true },
            }),
          }) as never,
        getTerrainRuntime: () =>
          ({
            getGameplayGrid: () => ({
              isCellWalkable: () => true,
              cellToWorldCenter: () => null,
            }),
          }) as never,
        getEntitySystem: () => ({ addEntity }) as never,
        getWorldPoint: () => ({ x: 0, y: 0 }),
        selectEntity: vi.fn(),
        getBarnPostsCellQuery: () => ({
          isBarnPostsCell: () => false,
          width: 4,
          height: 4,
        }),
        createMobNavigation: () => null,
      },
      new WorldSceneProjectionEmitter({
        getRuntimeHost: () => ({
          events: {
            emit,
            on: vi.fn(),
            off: vi.fn(),
          },
        }),
      }),
    );

    controller.handleSpawnMob({ entityId: "npc.animals.chicken" });

    expect(addEntity).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.MOB_SPAWN_FAILED, {
      entityId: "npc.animals.chicken",
      reason: "no-valid-spawn-area",
    });
  });

  test("handleSpawnMob: ignores non-npc entity ids", () => {
    const addEntity = vi.fn();

    const controller = new WorldScenePlacementController(
      {
        getEntityRegistry: () =>
          ({
            getRuntimeById: () => ({
              definition: { kind: "player", placeable: true },
            }),
          }) as never,
        getTerrainRuntime: () =>
          ({
            getGameplayGrid: () => ({
              isCellWalkable: () => true,
              cellToWorldCenter: () => ({ worldX: 48, worldY: 48 }),
            }),
          }) as never,
        getEntitySystem: () => ({ addEntity }) as never,
        getWorldPoint: () => ({ x: 0, y: 0 }),
        selectEntity: vi.fn(),
        getBarnPostsCellQuery: () => ({
          isBarnPostsCell: () => true,
          width: 4,
          height: 4,
        }),
        createMobNavigation: () => null,
      },
      new WorldSceneProjectionEmitter({
        getRuntimeHost: () => ({
          events: {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
          },
        }),
      }),
    );

    controller.handleSpawnMob({ entityId: "player.female" });

    expect(addEntity).not.toHaveBeenCalled();
  });
});
