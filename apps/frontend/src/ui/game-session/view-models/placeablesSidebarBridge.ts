import type {
  PlaceableViewModel,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import type { PlaceablesPanelViewModel } from "../contracts";
import {
  resolveActiveTerrainToolId,
  startPlaceableDrag,
} from "./placeablesBridge";

type CreatePlaceablesSidebarBridgeParams = {
  placeables: PlaceableViewModel[];
  activeTerrainTool: TerrainToolSelection;
  onSelectTerrainTool: (tool: TerrainToolSelection) => void;
};

export function createPlaceablesSidebarBridge({
  placeables,
  activeTerrainTool,
  onSelectTerrainTool,
}: CreatePlaceablesSidebarBridgeParams): PlaceablesPanelViewModel {
  return {
    placeables,
    activeTerrainToolId: resolveActiveTerrainToolId(
      placeables,
      activeTerrainTool,
    ),
    onDragStart(event, placeable) {
      startPlaceableDrag(event, placeable);
    },
    onSelectTerrainTool(placeable) {
      if (
        activeTerrainTool &&
        activeTerrainTool.brushId === placeable.brushId &&
        activeTerrainTool.materialId === placeable.materialId
      ) {
        onSelectTerrainTool(null);
        return;
      }

      onSelectTerrainTool({
        materialId: placeable.materialId,
        brushId: placeable.brushId,
      });
    },
  };
}
