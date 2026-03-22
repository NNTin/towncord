import Phaser from "phaser";
import { createGame } from "../phaser/createGame";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
  type PreviewAnimationRequest,
  type PreviewRuntimeInfo,
  type PreviewTileRequest,
} from "../previewRuntimeContract";
import {
  RUNTIME_TO_UI_EVENTS,
  UI_TO_RUNTIME_COMMANDS,
  bindRuntimeToUiEvent,
  emitPlaceDropCommand,
  emitUiToRuntimeCommand,
  toPlaceDropPayload,
  type RuntimeBootstrapPayload,
  type OfficeFloorPickedPayload,
  type OfficeSetEditorToolPayload,
  type PlaceDragPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  type ZoomChangedPayload,
} from "../protocol";
import { PreviewScene } from "../scenes/PreviewScene";
import type { OfficeSceneLayout } from "../officeLayoutContract";

export type {
  PreviewAnimationRequest,
  PreviewTileRequest,
} from "../previewRuntimeContract";

type RuntimeHost = {
  destroy: (removeCanvas: boolean, noReturn?: boolean) => void;
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

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

export type RuntimeBootstrap = RuntimeBootstrapPayload;
export type RuntimeTerrainInspection = TerrainTileInspectedPayload;
export type RuntimeDiagnostics = RuntimePerfPayload;
export type RuntimeZoomState = ZoomChangedPayload;
export type RuntimeTerrainToolSelection = SelectedTerrainToolPayload;
export type PreviewAnimationPayload = PreviewAnimationRequest;
export type PreviewTilePayload = PreviewTileRequest;
export type PreviewRuntimeState = PreviewRuntimeInfo;

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

export type PreviewRuntimeGatewayNotifications = {
  onInfo?: (payload: PreviewRuntimeState) => void;
};

export type PreviewRuntimeGatewaySession = {
  subscribe: (notifications: PreviewRuntimeGatewayNotifications) => () => void;
  showAnimation: (payload: PreviewAnimationRequest) => void;
  showTile: (payload: PreviewTileRequest) => void;
  destroy: () => void;
};

export type PreviewRuntimeGateway = {
  mount: (container: HTMLElement) => PreviewRuntimeGatewaySession;
};

function createPreviewRuntimeHost(parent: HTMLElement): RuntimeHost {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: "#0f172a",
    parent,
    scene: [PreviewScene],
    input: { keyboard: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    disableContextMenu: true,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      antialiasGL: false,
    },
  });
}

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
    },
  };
}

export function createPreviewRuntimeGateway(options: {
  createRuntime?: RuntimeFactory;
} = {}): PreviewRuntimeGateway {
  const createRuntime = options.createRuntime ?? createPreviewRuntimeHost;

  return {
    mount(container) {
      const runtime = createRuntime(container);
      const subscribers = new Set<PreviewRuntimeGatewayNotifications>();
      let pendingCommand:
        | { type: "animation"; payload: PreviewAnimationRequest }
        | { type: "tile"; payload: PreviewTileRequest }
        | null = null;
      let ready = false;
      let destroyed = false;

      const notifyInfo = (payload: PreviewRuntimeState): void => {
        for (const subscriber of subscribers) {
          subscriber.onInfo?.(payload);
        }
      };

      const unbindReady = bindPreviewRuntimeEvent(
        runtime,
        PREVIEW_READY_EVENT,
        () => {
          ready = true;
          if (!pendingCommand) {
            return;
          }

          if (pendingCommand.type === "tile") {
            runtime.events.emit(PREVIEW_SHOW_TILE_EVENT, pendingCommand.payload);
          } else {
            runtime.events.emit(PREVIEW_PLAY_EVENT, pendingCommand.payload);
          }

          pendingCommand = null;
        },
      );
      const unbindInfo = bindPreviewRuntimeEvent(
        runtime,
        PREVIEW_INFO_EVENT,
        (payload: PreviewRuntimeState) => notifyInfo(payload),
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

          runtime.events.emit(PREVIEW_PLAY_EVENT, payload);
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

          runtime.events.emit(PREVIEW_SHOW_TILE_EVENT, payload);
        },
        destroy,
      };
    },
  };
}

function bindPreviewRuntimeEvent<T>(
  runtime: RuntimeHost,
  event: string,
  handler: (payload: T) => void,
): () => void {
  const wrapped = (payload: unknown): void => {
    handler(payload as T);
  };

  runtime.events.on(event, wrapped);
  return () => {
    runtime.events.off(event, wrapped);
  };
}

export const runtimeGateway = createRuntimeGateway();
export const previewRuntimeGateway = createPreviewRuntimeGateway();
