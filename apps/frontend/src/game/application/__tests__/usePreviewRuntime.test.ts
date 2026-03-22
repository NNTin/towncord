import { describe, expect, test, vi } from "vitest";

vi.mock("../runtimeGateway", () => ({
  previewRuntimeGateway: {
    mount: vi.fn(),
  },
}));

import { createPreviewRuntimeAdapter } from "../usePreviewRuntime";

describe("createPreviewRuntimeAdapter", () => {
  test("routes inspected tiles through the preview gateway session", () => {
    const sessionRef = {
      current: {
        showAnimation: vi.fn(),
        showTile: vi.fn(),
      },
    };
    const adapter = createPreviewRuntimeAdapter({
      onInfo: vi.fn(),
      sessionRef: sessionRef as never,
    });

    adapter.showPreviewTile({
      textureKey: "debug.tilesets",
      frame: "grass_0",
      caseId: 2,
      materialId: "grass",
      cellX: 4,
      cellY: 6,
      rotate90: 0,
      flipX: false,
      flipY: false,
    });

    expect(sessionRef.current.showTile).toHaveBeenCalledWith({
      textureKey: "debug.tilesets",
      frame: "grass_0",
      caseId: 2,
      materialId: "grass",
      cellX: 4,
      cellY: 6,
      rotate90: 0,
      flipX: false,
      flipY: false,
    });
  });

  test("clears info when no animation is available and otherwise uses the preview gateway", () => {
    const onInfo = vi.fn();
    const sessionRef = {
      current: {
        showAnimation: vi.fn(),
        showTile: vi.fn(),
      },
    };
    const adapter = createPreviewRuntimeAdapter({
      onInfo,
      sessionRef: sessionRef as never,
    });

    adapter.showPreviewAnimation(null, null);
    adapter.showPreviewAnimation(
      {
        key: "characters.bloomseed.player.idle.down",
        flipX: false,
        equipKey: null,
        equipFlipX: false,
        frameIndex: null,
      },
      null,
    );

    expect(onInfo).toHaveBeenCalledWith(null);
    expect(sessionRef.current.showAnimation).toHaveBeenCalledWith({
      key: "characters.bloomseed.player.idle.down",
      flipX: false,
      equipKey: null,
      equipFlipX: false,
      frameIndex: null,
    });
  });
});
