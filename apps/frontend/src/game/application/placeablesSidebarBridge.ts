import type { DragEvent } from "react";
import {
  PLACE_DRAG_MIME,
  type PlaceDragPayload,
  type SelectedTerrainToolPayload,
} from "../events";
import type {
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "./placeableService";

type CreatePlaceablesSidebarBridgeParams = {
  placeables: PlaceableViewModel[];
  activeTerrainTool: SelectedTerrainToolPayload;
  onSelectTerrainTool: (tool: SelectedTerrainToolPayload) => void;
};

type PlaceablesSidebarBridge = {
  activeTerrainToolId: string | null;
  onDragStart: (event: DragEvent, placeable: PlaceableViewModel) => void;
  onSelectTerrainTool: (placeable: TerrainPlaceableViewModel) => void;
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
}: CreatePlaceablesSidebarBridgeParams): PlaceablesSidebarBridge {
  return {
    activeTerrainToolId: resolveActiveTerrainToolId(placeables, activeTerrainTool),
    onDragStart(event, placeable) {
      event.dataTransfer.setData(PLACE_DRAG_MIME, JSON.stringify(toPlaceDragPayload(placeable)));
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
