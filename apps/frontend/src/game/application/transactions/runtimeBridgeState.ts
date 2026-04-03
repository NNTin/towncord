import type { OfficeSelectionChangedPayload } from "../../contracts/office-editor";
import type {
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  RuntimeZoomState,
  TerrainPropSelectionChangedPayload,
  TerrainPropToolSelection,
  TerrainTileInspectedPayload,
  TerrainToolSelection,
} from "../../contracts/runtime";

export type RuntimeBridgeState = {
  bootstrap: RuntimeBootstrapPayload | null;
  inspectedTile: TerrainTileInspectedPayload | null;
  activeTerrainTool: TerrainToolSelection;
  activeTerrainPropTool: TerrainPropToolSelection;
  runtimeDiagnostics: RuntimePerfPayload | null;
  zoomState: RuntimeZoomState | null;
  officeSelection: OfficeSelectionChangedPayload | null;
  terrainPropSelection: TerrainPropSelectionChangedPayload | null;
};

export type RuntimeBridgeAction =
  | { type: "runtimeBootstrapped"; payload: RuntimeBootstrapPayload }
  | { type: "terrainTileInspected"; payload: TerrainTileInspectedPayload }
  | { type: "runtimeDiagnosticsUpdated"; payload: RuntimePerfPayload }
  | { type: "zoomChanged"; payload: RuntimeZoomState }
  | { type: "terrainToolSelected"; tool: TerrainToolSelection }
  | { type: "terrainPropToolSelected"; tool: TerrainPropToolSelection }
  | { type: "officeSelectionChanged"; payload: OfficeSelectionChangedPayload }
  | {
      type: "terrainPropSelectionChanged";
      payload: TerrainPropSelectionChangedPayload;
    }
  | { type: "inspectedTileCleared" };

export function createRuntimeBridgeState(): RuntimeBridgeState {
  return {
    bootstrap: null,
    inspectedTile: null,
    activeTerrainTool: null,
    activeTerrainPropTool: null,
    runtimeDiagnostics: null,
    zoomState: null,
    officeSelection: null,
    terrainPropSelection: null,
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
        activeTerrainTool:
          action.tool &&
          action.tool.terrainSourceId === undefined &&
          state.activeTerrainTool?.terrainSourceId
            ? {
                ...action.tool,
                terrainSourceId: state.activeTerrainTool.terrainSourceId,
              }
            : action.tool,
        activeTerrainPropTool: null,
        inspectedTile: action.tool ? null : state.inspectedTile,
      };
    case "terrainPropToolSelected":
      return {
        ...state,
        activeTerrainTool: null,
        activeTerrainPropTool: action.tool,
        inspectedTile: action.tool ? null : state.inspectedTile,
      };
    case "officeSelectionChanged":
      return {
        ...state,
        officeSelection: action.payload,
      };
    case "terrainPropSelectionChanged":
      return {
        ...state,
        terrainPropSelection: action.payload,
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
