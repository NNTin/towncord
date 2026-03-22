import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../../protocol";
import { WorldSceneDiagnosticsController } from "../worldSceneDiagnosticsController";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

describe("WorldSceneDiagnosticsController", () => {
  test("throttles runtime perf projections to 100ms intervals", () => {
    const emit = vi.fn();
    let now = 1_000;
    const projections = new WorldSceneProjectionEmitter({
      getRuntimeHost: () => ({
        events: {
          emit,
          on: vi.fn(),
          off: vi.fn(),
        },
      }),
    });
    const controller = new WorldSceneDiagnosticsController(projections, {
      now: () => now,
    });

    controller.recordFrame(16, 960, 3);
    controller.recordFrame(17, 965, 4);
    now = 1_110;
    controller.recordFrame(20, 1_050, 5);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(
      1,
      RUNTIME_TO_UI_EVENTS.RUNTIME_PERF,
      expect.objectContaining({
        timestampMs: 1_000,
        frameMs: 16,
        terrainMs: 3,
      }),
    );
    expect(emit).toHaveBeenNthCalledWith(
      2,
      RUNTIME_TO_UI_EVENTS.RUNTIME_PERF,
      expect.objectContaining({
        timestampMs: 1_110,
        frameMs: 20,
        terrainMs: 5,
      }),
    );
  });
});
