import type { OfficeSceneLayout } from "../contracts/office-scene";
import type {
  OfficeFloorPickedPayload,
  OfficeSetEditorToolPayload,
} from "../contracts/office-editor";
import type {
  PlaceDragPayload,
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  TerrainTileInspectedPayload,
  ZoomChangedPayload,
  SelectedTerrainToolPayload,
} from "../contracts/runtime";

type ScreenPoint = {
  screenX: number;
  screenY: number;
};

export type RuntimeBootstrap = RuntimeBootstrapPayload;
export type RuntimeTerrainInspection = TerrainTileInspectedPayload;
export type RuntimeDiagnostics = RuntimePerfPayload;
export type RuntimeZoomState = ZoomChangedPayload;
export type RuntimeTerrainToolSelection = SelectedTerrainToolPayload;

export type RuntimeLifecycleProjectionPort = {
  onBootstrap?: (payload: RuntimeBootstrap) => void;
};

export type RuntimeTerrainProjectionPort = {
  onTerrainTileInspected?: (payload: RuntimeTerrainInspection) => void;
};

export type RuntimeDiagnosticsProjectionPort = {
  onRuntimeDiagnostics?: (payload: RuntimeDiagnostics) => void;
};

export type RuntimeCameraProjectionPort = {
  onZoomChanged?: (payload: RuntimeZoomState) => void;
};

export type RuntimeOfficeProjectionPort = {
  onOfficeLayoutChanged?: (layout: OfficeSceneLayout) => void;
  onOfficeFloorPicked?: (payload: OfficeFloorPickedPayload) => void;
};

export type GameSessionNotifications = RuntimeLifecycleProjectionPort &
  RuntimeTerrainProjectionPort &
  RuntimeDiagnosticsProjectionPort &
  RuntimeCameraProjectionPort &
  RuntimeOfficeProjectionPort;

export type RuntimePlacementCommandPort = {
  placeDragDrop: (payload: PlaceDragPayload, point: ScreenPoint) => void;
};

export type RuntimeTerrainCommandPort = {
  selectTerrainTool: (tool: RuntimeTerrainToolSelection) => void;
};

export type RuntimeCameraCommandPort = {
  setZoom: (zoom: number) => void;
};

export type RuntimeOfficeCommandPort = {
  setOfficeEditorTool: (payload: OfficeSetEditorToolPayload) => void;
};

export type GameSession = RuntimePlacementCommandPort &
  RuntimeTerrainCommandPort &
  RuntimeCameraCommandPort &
  RuntimeOfficeCommandPort & {
    subscribe: (notifications: GameSessionNotifications) => () => void;
    destroy: () => void;
  };
