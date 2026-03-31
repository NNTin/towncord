import { UI_BOOTSTRAP_REGISTRY_KEY } from "../../application/runtime-compilation/load-plans/runtimeBootstrap";
import type { RuntimeHost } from "../../runtime/transport/host";
import { toPlaceDropPayload } from "../../runtime/transport/placeDragPayload";
import {
  bindRuntimeToUiEvent,
  normalizeRuntimeBootstrapPayload,
  RUNTIME_TO_UI_EVENTS,
} from "../../runtime/transport/runtimeEvents";
import {
  emitPlaceDropCommand,
  emitUiToRuntimeCommand,
  UI_TO_RUNTIME_COMMANDS,
} from "../../runtime/transport/uiCommands";
import type { GameSession, GameSessionNotifications } from "../GameSession";

export function createMountedGameSession(runtime: RuntimeHost): GameSession {
  const subscribers = new Set<GameSessionNotifications>();
  let bootstrapSnapshot:
    | Parameters<NonNullable<GameSessionNotifications["onBootstrap"]>>[0]
    | null = null;
  let terrainSeedSnapshot:
    | Parameters<
        NonNullable<GameSessionNotifications["onTerrainSeedChanged"]>
      >[0]
    | null = null;
  let officeSelectionSnapshot:
    | Parameters<
        NonNullable<GameSessionNotifications["onOfficeSelectionChanged"]>
      >[0]
    | null = null;
  let hasOfficeSelectionSnapshot = false;
  let destroyed = false;

  const forEachSubscriber = (
    visit: (subscriber: GameSessionNotifications) => void,
  ): void => {
    for (const subscriber of subscribers) {
      visit(subscriber);
    }
  };

  const publishBootstrapSnapshot = (
    payload: Parameters<
      NonNullable<GameSessionNotifications["onBootstrap"]>
    >[0],
  ): void => {
    if (bootstrapSnapshot) {
      return;
    }

    bootstrapSnapshot = payload;
    forEachSubscriber((subscriber) => subscriber.onBootstrap?.(payload));
  };

  const hydrateBootstrapSnapshotFromRegistry = (): void => {
    if (bootstrapSnapshot) {
      return;
    }

    const cachedBootstrap = normalizeRuntimeBootstrapPayload(
      runtime.getUiBootstrapSnapshot?.(),
    );
    if (cachedBootstrap) {
      publishBootstrapSnapshot(cachedBootstrap);
      return;
    }

    const registryBootstrap = normalizeRuntimeBootstrapPayload(
      runtime.registry?.get(UI_BOOTSTRAP_REGISTRY_KEY),
    );
    if (registryBootstrap) {
      publishBootstrapSnapshot(registryBootstrap);
    }
  };

  const unbindBootstrap = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.RUNTIME_READY,
    (payload) => publishBootstrapSnapshot(payload),
  );
  const unbindTerrainTileInspected = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      forEachSubscriber((subscriber) =>
        subscriber.onTerrainTileInspected?.(payload),
      );
    },
  );
  const unbindRuntimeDiagnostics = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.RUNTIME_PERF,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      forEachSubscriber((subscriber) =>
        subscriber.onRuntimeDiagnostics?.(payload),
      );
    },
  );
  const unbindZoomChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      forEachSubscriber((subscriber) => subscriber.onZoomChanged?.(payload));
    },
  );
  const unbindOfficeLayoutChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      forEachSubscriber((subscriber) =>
        subscriber.onOfficeLayoutChanged?.(payload.layout),
      );
    },
  );
  const unbindTerrainSeedChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      terrainSeedSnapshot = payload.seed;
      forEachSubscriber((subscriber) =>
        subscriber.onTerrainSeedChanged?.(payload.seed),
      );
    },
  );
  const unbindOfficeFloorPicked = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      forEachSubscriber((subscriber) =>
        subscriber.onOfficeFloorPicked?.(payload),
      );
    },
  );
  const unbindOfficeSelectionChanged = bindRuntimeToUiEvent(
    runtime,
    RUNTIME_TO_UI_EVENTS.OFFICE_SELECTION_CHANGED,
    (payload) => {
      hydrateBootstrapSnapshotFromRegistry();
      officeSelectionSnapshot = payload;
      hasOfficeSelectionSnapshot = true;
      forEachSubscriber((subscriber) =>
        subscriber.onOfficeSelectionChanged?.(payload),
      );
    },
  );

  hydrateBootstrapSnapshotFromRegistry();

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
    unbindTerrainSeedChanged();
    unbindOfficeFloorPicked();
    unbindOfficeSelectionChanged();
    runtime.destroy(true);
  };

  return {
    subscribe(notifications) {
      if (destroyed) {
        return () => {};
      }

      subscribers.add(notifications);
      hydrateBootstrapSnapshotFromRegistry();
      if (bootstrapSnapshot) {
        notifications.onBootstrap?.(bootstrapSnapshot);
      }
      if (terrainSeedSnapshot) {
        notifications.onTerrainSeedChanged?.(terrainSeedSnapshot);
      }
      if (hasOfficeSelectionSnapshot) {
        notifications.onOfficeSelectionChanged?.(
          officeSelectionSnapshot ?? { selection: null },
        );
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

      emitUiToRuntimeCommand(runtime, UI_TO_RUNTIME_COMMANDS.SET_ZOOM, {
        zoom,
      });
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
    rotateSelectedOfficePlaceable() {
      if (destroyed) {
        return;
      }

      emitUiToRuntimeCommand(
        runtime,
        UI_TO_RUNTIME_COMMANDS.OFFICE_SELECTION_ACTION,
        { action: "rotate" },
      );
    },
    deleteSelectedOfficePlaceable() {
      if (destroyed) {
        return;
      }

      emitUiToRuntimeCommand(
        runtime,
        UI_TO_RUNTIME_COMMANDS.OFFICE_SELECTION_ACTION,
        { action: "delete" },
      );
    },
    destroy,
  };
}
