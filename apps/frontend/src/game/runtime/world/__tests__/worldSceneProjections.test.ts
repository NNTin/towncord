import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../transport/runtimeEvents";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

describe("WorldSceneProjectionEmitter", () => {
  test("emits explicit runtime projections through the protocol host", () => {
    const emit = vi.fn();
    const projections = new WorldSceneProjectionEmitter({
      getRuntimeHost: () => ({
        events: {
          emit,
          on: vi.fn(),
          off: vi.fn(),
        },
      }),
    });

    projections.emitPlayerStateChanged({ state: "run" });
    projections.emitZoomChanged({
      zoom: 3,
      minZoom: 1,
      maxZoom: 16,
    });
    projections.emitTerrainSeedChanged({
      seed: {
        width: 2,
        height: 1,
        chunkSize: 32,
        defaultMaterial: "grass",
        materials: ["grass"],
        legend: {
          ".": "grass",
        },
        rows: [".."],
      },
    });

    expect(emit).toHaveBeenNthCalledWith(
      1,
      RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED,
      { state: "run" },
    );
    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, {
      zoom: 3,
      minZoom: 1,
      maxZoom: 16,
    });
    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED, {
      seed: {
        width: 2,
        height: 1,
        chunkSize: 32,
        defaultMaterial: "grass",
        materials: ["grass"],
        legend: {
          ".": "grass",
        },
        rows: [".."],
      },
    });
  });
});
