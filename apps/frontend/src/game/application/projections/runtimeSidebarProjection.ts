import type {
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  TerrainTileInspectedPayload,
} from "../../contracts/runtime";
import type { RuntimeBridgeState } from "../transactions/runtimeBridgeState";

export type RuntimeSidebarProjection = {
  catalog: RuntimeBootstrapPayload["catalog"];
  placeables: RuntimeBootstrapPayload["placeables"];
  inspectedTile: TerrainTileInspectedPayload | null;
  runtimeDiagnostics: RuntimePerfPayload | null;
};

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
