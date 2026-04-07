import type {
  PlaceableViewModel,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import type { PlaceablesPanelViewModel } from "../contracts";
import {
  isEntityPlaceable,
  resolveActiveTerrainToolId,
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
  // Entity placeables are spawned via the bottom toolbar (click-to-spawn);
  // only terrain placeables remain in the sidebar panel.
  const terrainPlaceables = placeables.filter(
    (placeable) => !isEntityPlaceable(placeable),
  );

  return {
    placeables: terrainPlaceables,
    activeTerrainToolId: resolveActiveTerrainToolId(
      terrainPlaceables,
      activeTerrainTool,
    ),
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
