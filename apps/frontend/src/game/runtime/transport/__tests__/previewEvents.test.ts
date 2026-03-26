import { describe, expect, test, vi } from "vitest";
import {
  bindPreviewRuntimeEvent,
  emitPreviewRuntimeEvent,
  PREVIEW_INFO_EVENT,
} from "../previewEvents";

type Listener = (payload: unknown) => void;

function createHost() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    host: {
      events: {
        emit(event: string, payload?: unknown) {
          for (const listener of listeners.get(event) ?? []) {
            listener(payload);
          }
        },
        on(event: string, fn: Listener) {
          const eventListeners = listeners.get(event) ?? new Set<Listener>();
          eventListeners.add(fn);
          listeners.set(event, eventListeners);
        },
        off(event: string, fn: Listener) {
          listeners.get(event)?.delete(fn);
        },
      },
    },
  };
}

describe("previewEvents transport", () => {
  test("binds and emits preview runtime notifications", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const unbind = bindPreviewRuntimeEvent(host, PREVIEW_INFO_EVENT, handler);
    const payload = {
      sourceType: "animation" as const,
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

    emitPreviewRuntimeEvent(host, PREVIEW_INFO_EVENT, payload);

    expect(handler).toHaveBeenCalledWith(payload);

    unbind();
    emitPreviewRuntimeEvent(host, PREVIEW_INFO_EVENT, payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
