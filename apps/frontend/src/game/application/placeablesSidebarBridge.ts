import type { DragEvent } from "react";
import {
  PLACE_DRAG_MIME,
  serializePlaceDragPayload,
  type PlaceDragPayload,
  type SelectedTerrainToolPayload,
} from "../protocol";
import type { PlaceablesPanelViewModel } from "./runtimeViewModels";
import type {
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "./placeableService";

type CreatePlaceablesSidebarBridgeParams = {
  placeables: PlaceableViewModel[];
  activeTerrainTool: SelectedTerrainToolPayload;
  onSelectTerrainTool: (tool: SelectedTerrainToolPayload) => void;
};

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
  activeTerrainTool: SelectedTerrainToolPayload,
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

export function createPlaceablesSidebarBridge({
  placeables,
  activeTerrainTool,
  onSelectTerrainTool,
}: CreatePlaceablesSidebarBridgeParams): PlaceablesPanelViewModel {
  return {
    placeables,
    activeTerrainToolId: resolveActiveTerrainToolId(placeables, activeTerrainTool),
    onDragStart(event, placeable) {
      event.dataTransfer.setData(PLACE_DRAG_MIME, serializePlaceDragPayload(toPlaceDragPayload(placeable)));
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
