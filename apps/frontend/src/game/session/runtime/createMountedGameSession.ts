import type { RuntimeHost } from "../../runtime/transport/host";
import { toPlaceDropPayload } from "../../runtime/transport/placeDragPayload";
import {
  bindRuntimeToUiEvent,
  RUNTIME_TO_UI_EVENTS,
} from "../../runtime/transport/runtimeEvents";
import {
  emitPlaceDropCommand,
  emitUiToRuntimeCommand,
  UI_TO_RUNTIME_COMMANDS,
} from "../../runtime/transport/uiCommands";
import type {
  GameSession,
  GameSessionNotifications,
} from "../GameSession";

export function createMountedGameSession(runtime: RuntimeHost): GameSession {
  const subscribers = new Set<GameSessionNotifications>();
  let bootstrapSnapshot:
    | Parameters<NonNullable<GameSessionNotifications["onBootstrap"]>>[0]
    | null = null;
  let destroyed = false;

  const forEachSubscriber = (
    visit: (subscriber: GameSessionNotifications) => void,
  ): void => {
    for (const subscriber of subscribers) {
      visit(subscriber);
    }
  };

  const unbindBootstrap = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.RUNTIME_READY,
    (payload) => {
      if (bootstrapSnapshot) {
        return;
      }

      bootstrapSnapshot = payload;
      forEachSubscriber((subscriber) => subscriber.onBootstrap?.(payload));
    },
  );
  const unbindTerrainTileInspected = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED,
    (payload) =>
      forEachSubscriber((subscriber) =>
        subscriber.onTerrainTileInspected?.(payload),
      ),
  );
  const unbindRuntimeDiagnostics = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.RUNTIME_PERF,
    (payload) =>
      forEachSubscriber((subscriber) =>
        subscriber.onRuntimeDiagnostics?.(payload),
      ),
  );
  const unbindZoomChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED,
    (payload) =>
      forEachSubscriber((subscriber) => subscriber.onZoomChanged?.(payload)),
  );
  const unbindOfficeLayoutChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
    (payload) =>
      forEachSubscriber((subscriber) =>
        subscriber.onOfficeLayoutChanged?.(payload.layout),
      ),
  );
  const unbindOfficeFloorPicked = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED,
    (payload) =>
      forEachSubscriber((subscriber) =>
        subscriber.onOfficeFloorPicked?.(payload),
      ),
  );

  const destroy = (): void => {
    if (destroyed) {
      return;
    }

    destroyed = true;
    subscribers.clear();
    unbindBootstrap();
    unbindTerrainTileInspected();
    unbindRuntimeDiagnostics();
    unbindZoomChanged();
    unbindOfficeLayoutChanged();
    unbindOfficeFloorPicked();
    runtime.destroy(true);
  };

  return {
    subscribe(notifications) {
      if (destroyed) {
        return () => {};
      }

      subscribers.add(notifications);
      if (bootstrapSnapshot) {
        notifications.onBootstrap?.(bootstrapSnapshot);
      }

      return () => {
        subscribers.delete(notifications);
      };
    },
    placeDragDrop(payload, point) {
      if (destroyed) {
        return;
      }

      emitPlaceDropCommand(
        runtime,
        toPlaceDropPayload(payload, point.screenX, point.screenY),
      );
    },
    selectTerrainTool(tool) {
      if (destroyed) {
        return;
      }

      emitUiToRuntimeCommand(
        runtime,
        UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
        tool,
      );
    },
    setZoom(zoom) {
      if (destroyed) {
        return;
      }

      emitUiToRuntimeCommand(runtime, UI_TO_RUNTIME_COMMANDS.SET_ZOOM, { zoom });
    },
    setOfficeEditorTool(payload) {
      if (destroyed) {
        return;
      }

      emitUiToRuntimeCommand(
        runtime,
        UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL,
        payload,
      );
    },
    destroy,
  };
}
