import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../../protocol";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

describe("WorldSceneProjectionEmitter", () => {
  test("emits typed runtime projections through the protocol host", () => {
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

    projections.emitZoomChanged({
      zoom: 3,
      minZoom: 1,
      maxZoom: 16,
    });

    expect(emit).toHaveBeenCalledWith(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, {
      zoom: 3,
      minZoom: 1,
      maxZoom: 16,
    });
  });
});
