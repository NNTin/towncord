import { createGame } from "../phaser/createGame";
import {
  RUNTIME_TO_UI_EVENTS,
  UI_TO_RUNTIME_COMMANDS,
  bindRuntimeToUiEvent,
  emitPlaceDropCommand,
  emitUiToRuntimeCommand,
  toPlaceDropPayload,
  type BloomseedUiBootstrap,
  type OfficeFloorPickedPayload,
  type OfficeSetEditorToolPayload,
  type PlaceDragPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  type ZoomChangedPayload,
} from "../protocol";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";

type RuntimeHost = {
  destroy: (removeCanvas?: boolean) => void;
  events: {
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
    off: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
  };
};

type ScreenPoint = {
  screenX: number;
  screenY: number;
};

type RuntimeFactory = (parent: HTMLElement) => RuntimeHost;

export type RuntimeBootstrap = BloomseedUiBootstrap;
export type RuntimeTerrainInspection = TerrainTileInspectedPayload;
export type RuntimeDiagnostics = RuntimePerfPayload;
export type RuntimeZoomState = ZoomChangedPayload;
export type RuntimeTerrainToolSelection = SelectedTerrainToolPayload;

export type RuntimeGatewayNotifications = {
  onBootstrap?: (payload: RuntimeBootstrap) => void;
  onTerrainTileInspected?: (payload: RuntimeTerrainInspection) => void;
  onRuntimeDiagnostics?: (payload: RuntimeDiagnostics) => void;
  onZoomChanged?: (payload: RuntimeZoomState) => void;
  onOfficeLayoutChanged?: (layout: OfficeSceneLayout) => void;
  onOfficeFloorPicked?: (payload: OfficeFloorPickedPayload) => void;
};

export type RuntimeGatewaySession = {
  subscribe: (notifications: RuntimeGatewayNotifications) => () => void;
  placeDragDrop: (payload: PlaceDragPayload, point: ScreenPoint) => void;
  selectTerrainTool: (tool: RuntimeTerrainToolSelection) => void;
  setZoom: (zoom: number) => void;
  setOfficeEditorTool: (payload: OfficeSetEditorToolPayload) => void;
  destroy: () => void;
};

export type RuntimeGateway = {
  mount: (container: HTMLElement) => RuntimeGatewaySession;
};

export function createRuntimeGateway(options: {
  createRuntime?: RuntimeFactory;
} = {}): RuntimeGateway {
  const createRuntime = options.createRuntime ?? createGame;

  return {
    mount(container) {
      const runtime = createRuntime(container);
      const subscribers = new Set<RuntimeGatewayNotifications>();
      let bootstrapSnapshot: RuntimeBootstrap | null = null;
      let destroyed = false;

      const forEachSubscriber = (
        visit: (subscriber: RuntimeGatewayNotifications) => void,
      ): void => {
        for (const subscriber of subscribers) {
          visit(subscriber);
        }
      };

      const unbindBootstrap = bindRuntimeToUiEvent(
        runtime,
        RUNTIME_TO_UI_EVENTS.BLOOMSEED_READY,
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
    },
  };
}

export const bloomseedRuntimeGateway = createRuntimeGateway();
