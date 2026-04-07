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
        getCameraCenter: () => ({ x: 100, y: 160 }),
        getOfficeRegion: () => null,
        selectEntity,
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
        getCameraCenter: () => ({ x: 100, y: 160 }),
        getOfficeRegion: () => null,
        selectEntity: vi.fn(),
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
});
