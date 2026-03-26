import { PLACE_DRAG_MIME, serializePlaceDragPayload } from "../../../game";
import type {
  PlaceDragPayload,
  PlaceableViewModel,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import type { PlaceablesPanelViewModel } from "../contracts";

function toPlaceDragPayload(placeable: PlaceableViewModel): PlaceDragPayload {
  if (placeable.type === "entity") {
    return {
      type: "entity",
      entityId: placeable.entityId,
    };
  }

  return {
    type: "terrain",
    materialId: placeable.materialId,
    brushId: placeable.brushId,
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
        activeTerrainTool?.brushId === placeable.brushId &&
        activeTerrainTool?.materialId === placeable.materialId,
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
