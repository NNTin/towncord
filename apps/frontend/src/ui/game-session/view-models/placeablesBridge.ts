import type { DragEvent } from "react";
import { PLACE_DRAG_MIME, serializePlaceDragPayload } from "../../../game";
import type {
  EntityPlaceableViewModel,
  PlaceDragPayload,
  PlaceableViewModel,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import type { PlaceableGroupViewModel } from "../contracts";

export function isEntityPlaceable(
  placeable: PlaceableViewModel,
): placeable is EntityPlaceableViewModel {
  return placeable.type === "entity";
}

export function groupPlaceablesByGroup<TPlaceable extends PlaceableViewModel>(
  placeables: TPlaceable[],
): PlaceableGroupViewModel<TPlaceable>[] {
  const byGroup = new Map<string, PlaceableGroupViewModel<TPlaceable>>();

  for (const placeable of placeables) {
    if (!byGroup.has(placeable.groupKey)) {
      byGroup.set(placeable.groupKey, {
        key: placeable.groupKey,
        label: placeable.groupLabel,
        placeables: [],
      });
    }

    byGroup.get(placeable.groupKey)!.placeables.push(placeable);
  }

  return [...byGroup.values()];
}

export function toPlaceDragPayload(
  placeable: PlaceableViewModel,
): PlaceDragPayload {
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

export function startPlaceableDrag(
  event: Pick<DragEvent, "dataTransfer">,
  placeable: PlaceableViewModel,
): void {
  event.dataTransfer.setData(
    PLACE_DRAG_MIME,
    serializePlaceDragPayload(toPlaceDragPayload(placeable)),
  );
  event.dataTransfer.effectAllowed = "copy";
}

export function resolveActiveTerrainToolId(
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
