import { PLACE_DRAG_MIME, serializePlaceDragPayload } from "../../../game";
import type {
  EntityPlaceableViewModel,
  PlaceDragPayload,
  PlaceableViewModel,
  TerrainPlaceableViewModel,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import type { PlaceablesPanelViewModel } from "../contracts";

function toPlaceDragPayload(placeable: PlaceableViewModel): PlaceDragPayload {
  if (placeable.type === "entity") {
    return {
      type: "entity",
      entityId: (placeable as EntityPlaceableViewModel).entityId,
    };
  }

  const terrain = placeable as TerrainPlaceableViewModel;
  return {
    type: "terrain",
    materialId: terrain.materialId,
    brushId: terrain.brushId,
  };
}

function resolveActiveTerrainToolId(
  placeables: PlaceableViewModel[],
  activeTerrainTool: TerrainToolSelection,
): string | null {
  return (
    placeables.find(
      (placeable) =>
        placeable.type === "terrain" &&
        activeTerrainTool?.brushId ===
          (placeable as TerrainPlaceableViewModel).brushId &&
        activeTerrainTool?.materialId ===
          (placeable as TerrainPlaceableViewModel).materialId,
    )?.id ?? null
  );
}

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
      event.dataTransfer.setData(
        PLACE_DRAG_MIME,
        serializePlaceDragPayload(toPlaceDragPayload(placeable)),
      );
      event.dataTransfer.effectAllowed = "copy";
    },
    onSelectTerrainTool(placeable) {
      const terrain = placeable as TerrainPlaceableViewModel;
      if (
        activeTerrainTool &&
        activeTerrainTool.brushId === terrain.brushId &&
        activeTerrainTool.materialId === terrain.materialId
      ) {
        onSelectTerrainTool(null);
        return;
      }

      onSelectTerrainTool({
        materialId: terrain.materialId,
        brushId: terrain.brushId,
      });
    },
  };
}
