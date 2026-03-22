import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../../protocol";
import { WorldSceneCameraController } from "../worldSceneCameraController";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

vi.mock("phaser", () => {
  class Scene {
    constructor(_key?: string) {}
  }

  return {
    default: {
      Scene,
      Math: {
        Clamp(value: number, min: number, max: number) {
          return Math.min(Math.max(value, min), max);
        },
      },
      Input: {
        Keyboard: {
          KeyCodes: {
            SHIFT: 16,
          },
        },
      },
    },
  };
});

function createHarness() {
  const emit = vi.fn();
  const camera = {
    zoom: 1,
    width: 800,
    height: 600,
    scrollX: 50,
    scrollY: 70,
    setScroll: vi.fn(function (this: { scrollX: number; scrollY: number }, x: number, y: number) {
      this.scrollX = x;
      this.scrollY = y;
      return this;
    }),
    setZoom: vi.fn(function (this: { zoom: number }, zoom: number) {
      this.zoom = zoom;
      return this;
    }),
  };
  const terrainSystem = {
    getGameplayGrid: () => ({
      getWorldBounds: () => ({
        width: 2_000,
        height: 1_200,
      }),
    }),
  };
  const controller = new WorldSceneCameraController(
    {
      getCamera: () => camera as never,
      getTerrainSystem: () => terrainSystem as never,
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

  return {
    camera,
    controller,
    emit,
  };
}

describe("WorldSceneCameraController", () => {
  test("initializes zoom, centers the camera, and emits the zoom projection", () => {
    const { camera, controller, emit } = createHarness();

    controller.initialize();

    expect(camera.setZoom).toHaveBeenCalledWith(2);
    expect(camera.setScroll).toHaveBeenCalledWith(555, 300);
    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, {
      zoom: 2,
      minZoom: 1,
      maxZoom: 16,
    });
  });

  test("updates camera scroll while panning using the current zoom", () => {
    const { camera, controller } = createHarness();

    camera.zoom = 2;
    controller.beginPan({
      x: 100,
      y: 100,
    } as never);
    controller.updatePan({
      x: 120,
      y: 80,
    } as never);

    expect(camera.setScroll).toHaveBeenCalledWith(40, 80);
  });
});
