import type { RuntimeHost } from "../../runtime/transport/host";
import {
  bindPreviewRuntimeEvent,
  emitPreviewRuntimeEvent,
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
} from "../../runtime/transport/previewEvents";
import type {
  PreviewSession,
  PreviewSessionNotifications,
} from "../PreviewSession";

export function createMountedPreviewSession(
  runtime: RuntimeHost,
): PreviewSession {
  const subscribers = new Set<PreviewSessionNotifications>();
  let pendingCommand:
    | {
        type: "animation";
        payload: Parameters<PreviewSession["showAnimation"]>[0];
      }
    | {
        type: "tile";
        payload: Parameters<PreviewSession["showTile"]>[0];
      }
    | null = null;
  let ready = false;
  let destroyed = false;

  const notifyInfo = (
    payload: Parameters<NonNullable<PreviewSessionNotifications["onInfo"]>>[0],
  ): void => {
    for (const subscriber of subscribers) {
      subscriber.onInfo?.(payload);
    }
  };

  const unbindReady = bindPreviewRuntimeEvent(runtime, PREVIEW_READY_EVENT, () => {
    ready = true;
    if (!pendingCommand) {
      return;
    }

    emitPreviewRuntimeEvent(
      runtime,
      pendingCommand.type === "tile"
        ? PREVIEW_SHOW_TILE_EVENT
        : PREVIEW_PLAY_EVENT,
      pendingCommand.payload,
    );
    pendingCommand = null;
  });
  const unbindInfo = bindPreviewRuntimeEvent(
    runtime,
    PREVIEW_INFO_EVENT,
    notifyInfo,
  );

  const destroy = (): void => {
    if (destroyed) {
      return;
    }

    destroyed = true;
    subscribers.clear();
    pendingCommand = null;
    unbindReady();
    unbindInfo();
    runtime.destroy(true);
  };

  return {
    subscribe(notifications) {
      if (destroyed) {
        return () => {};
      }

      subscribers.add(notifications);
      return () => {
        subscribers.delete(notifications);
      };
    },
    showAnimation(payload) {
      if (destroyed) {
        return;
      }

      if (!ready) {
        pendingCommand = {
          type: "animation",
          payload,
        };
        return;
      }

      emitPreviewRuntimeEvent(runtime, PREVIEW_PLAY_EVENT, payload);
    },
    showTile(payload) {
      if (destroyed) {
        return;
      }

      if (!ready) {
        pendingCommand = {
          type: "tile",
          payload,
        };
        return;
      }

      emitPreviewRuntimeEvent(runtime, PREVIEW_SHOW_TILE_EVENT, payload);
    },
    destroy,
  };
}
