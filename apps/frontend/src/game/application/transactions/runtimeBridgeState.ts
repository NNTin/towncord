import type {
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  RuntimeZoomState,
  TerrainTileInspectedPayload,
  TerrainToolSelection,
} from "../../contracts/runtime";

export type RuntimeBridgeState = {
  bootstrap: RuntimeBootstrapPayload | null;
  inspectedTile: TerrainTileInspectedPayload | null;
  activeTerrainTool: TerrainToolSelection;
  runtimeDiagnostics: RuntimePerfPayload | null;
  zoomState: RuntimeZoomState | null;
};

export type RuntimeBridgeAction =
  | { type: "runtimeBootstrapped"; payload: RuntimeBootstrapPayload }
  | { type: "terrainTileInspected"; payload: TerrainTileInspectedPayload }
  | { type: "runtimeDiagnosticsUpdated"; payload: RuntimePerfPayload }
  | { type: "zoomChanged"; payload: RuntimeZoomState }
  | { type: "terrainToolSelected"; tool: TerrainToolSelection }
  | { type: "inspectedTileCleared" };

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
