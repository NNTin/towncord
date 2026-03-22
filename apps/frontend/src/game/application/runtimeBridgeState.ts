import type {
  RuntimeBootstrap,
  RuntimeDiagnostics,
  RuntimeTerrainInspection,
  RuntimeTerrainToolSelection,
  RuntimeZoomState,
} from "./runtimeGateway";

export type RuntimeBridgeState = {
  bootstrap: RuntimeBootstrap | null;
  inspectedTile: RuntimeTerrainInspection | null;
  activeTerrainTool: RuntimeTerrainToolSelection;
  runtimeDiagnostics: RuntimeDiagnostics | null;
  zoomState: RuntimeZoomState | null;
};

export type RuntimeBridgeAction =
  | { type: "runtimeBootstrapped"; payload: RuntimeBootstrap }
  | { type: "terrainTileInspected"; payload: RuntimeTerrainInspection }
  | { type: "runtimeDiagnosticsUpdated"; payload: RuntimeDiagnostics }
  | { type: "zoomChanged"; payload: RuntimeZoomState }
  | { type: "terrainToolSelected"; tool: RuntimeTerrainToolSelection }
  | { type: "inspectedTileCleared" };

export type RuntimeSidebarProjection = {
  catalog: RuntimeBootstrap["catalog"];
  placeables: RuntimeBootstrap["placeables"];
  inspectedTile: RuntimeTerrainInspection | null;
  runtimeDiagnostics: RuntimeDiagnostics | null;
};

export function createRuntimeBridgeState(): RuntimeBridgeState {
  return {
    bootstrap: null,
    inspectedTile: null,
    activeTerrainTool: null,
    runtimeDiagnostics: null,
    zoomState: null,
  };
}

export function reduceRuntimeBridgeState(
  state: RuntimeBridgeState,
  action: RuntimeBridgeAction,
): RuntimeBridgeState {
  switch (action.type) {
    case "runtimeBootstrapped":
      return {
        ...state,
        bootstrap: action.payload,
      };
    case "terrainTileInspected":
      return {
        ...state,
        inspectedTile: action.payload,
      };
    case "runtimeDiagnosticsUpdated":
      return {
        ...state,
        runtimeDiagnostics: action.payload,
      };
    case "zoomChanged":
      return {
        ...state,
        zoomState: action.payload,
      };
    case "terrainToolSelected":
      return {
        ...state,
        activeTerrainTool: action.tool,
        inspectedTile: action.tool ? null : state.inspectedTile,
      };
    case "inspectedTileCleared":
      return {
        ...state,
        inspectedTile: null,
      };
    default:
      return state;
  }
}

export function selectRuntimeSidebarProjection(
  state: RuntimeBridgeState,
): RuntimeSidebarProjection | null {
  if (!state.bootstrap) {
    return null;
  }

  return {
    catalog: state.bootstrap.catalog,
    placeables: state.bootstrap.placeables,
    inspectedTile: state.inspectedTile,
    runtimeDiagnostics: state.runtimeDiagnostics,
  };
}
