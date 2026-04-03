import type { PlaceableViewModel } from "../../../game/contracts/runtime";
import type { TerrainPropToolbarViewModel } from "../contracts";
import { groupPlaceablesByGroup, isEntityPlaceable } from "./placeablesBridge";

function isPropEntityPlaceable(
  placeable: PlaceableViewModel,
): placeable is Extract<PlaceableViewModel, { type: "entity" }> {
  return (
    isEntityPlaceable(placeable) &&
    placeable.groupKey.startsWith("entity:prop:")
  );
}

type CreateToolbarPropPaletteBridgeParams = {
  placeables: PlaceableViewModel[];
};

export function createTerrainPropPaletteBridge({
  placeables,
}: CreateToolbarPropPaletteBridgeParams): TerrainPropToolbarViewModel | null {
  const propPlaceables = placeables.filter(isPropEntityPlaceable);
  if (propPlaceables.length === 0) {
    return null;
  }

  return {
    groups: groupPlaceablesByGroup(propPlaceables),
  };
}

export { createTerrainPropPaletteBridge as createToolbarPropPaletteBridge };
export { isPropEntityPlaceable };
