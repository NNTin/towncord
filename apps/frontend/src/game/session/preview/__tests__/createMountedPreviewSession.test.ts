import { describe, expect, test, vi } from "vitest";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
} from "../../../runtime/transport/previewEvents";
import type { PreviewRuntimeState } from "../../PreviewSession";
import { createMountedPreviewSession } from "../createMountedPreviewSession";

function createRuntimeHost() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    destroy: vi.fn(),
    events: {
      emit: vi.fn((event: string, payload?: unknown) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      }),
      on: vi.fn((event: string, listener: (payload: unknown) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }

        listeners.get(event)?.add(listener);
      }),
      off: vi.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.get(event)?.delete(listener);
      }),
    },
  };
}

describe("createMountedPreviewSession", () => {
  test("queues preview commands until ready and forwards runtime info", () => {
    const runtimeHost = createRuntimeHost();
    const session = createMountedPreviewSession(runtimeHost as never);
    const onInfo = vi.fn();
    const payload: PreviewRuntimeState = {
      sourceType: "animation",
      animationKey: "characters.bloomseed.player.idle.down",
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 6,
      flipX: false,
      flipY: false,
      scale: 3,
      displayWidth: 192,
      displayHeight: 192,
    };

    session.subscribe({ onInfo });
    session.showTile({
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
    runtimeHost.events.emit(PREVIEW_INFO_EVENT, payload);
    runtimeHost.events.emit(PREVIEW_READY_EVENT);
    runtimeHost.events.emit(PREVIEW_READY_EVENT);
    session.showAnimation({
      key: payload.animationKey,
      flipX: false,
      equipKey: null,
      equipFlipX: false,
      frameIndex: null,
    });

    expect(onInfo).toHaveBeenCalledWith(payload);
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      3,
      PREVIEW_SHOW_TILE_EVENT,
      {
        textureKey: "debug.tilesets",
        frame: "grass_0",
        caseId: 2,
        materialId: "grass",
        cellX: 4,
        cellY: 6,
        rotate90: 0,
        flipX: false,
        flipY: false,
      },
    );
    expect(runtimeHost.events.emit).toHaveBeenLastCalledWith(PREVIEW_PLAY_EVENT, {
      key: payload.animationKey,
      flipX: false,
      equipKey: null,
      equipFlipX: false,
      frameIndex: null,
    });
  });

  test("supports unsubscribe and destroys the preview runtime idempotently", () => {
    const runtimeHost = createRuntimeHost();
    const session = createMountedPreviewSession(runtimeHost as never);
    const onInfo = vi.fn();
    const unsubscribe = session.subscribe({ onInfo });

    unsubscribe();
    runtimeHost.events.emit(PREVIEW_INFO_EVENT, {
      sourceType: "terrain-tile",
      animationKey: "grass_0",
      frameWidth: 16,
      frameHeight: 16,
      frameCount: 1,
      flipX: false,
      flipY: false,
      scale: 3,
      displayWidth: 48,
      displayHeight: 48,
      caseId: 2,
      materialId: "grass",
      cellX: 1,
      cellY: 2,
      rotate90: 0,
    } satisfies PreviewRuntimeState);

    session.destroy();
    session.destroy();
    session.showTile({
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

    expect(onInfo).not.toHaveBeenCalled();
    expect(runtimeHost.destroy).toHaveBeenCalledTimes(1);
    expect(runtimeHost.destroy).toHaveBeenCalledWith(true);
    expect(runtimeHost.events.emit).toHaveBeenCalledTimes(1);
  });
});
