import type { PlaceableViewModel } from "../../../game/contracts/runtime";
import type { PropToolbarViewModel } from "../contracts";
import {
  groupPlaceablesByGroup,
  isEntityPlaceable,
  startPlaceableDrag,
} from "./placeablesBridge";

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

export function createToolbarPropPaletteBridge({
  placeables,
}: CreateToolbarPropPaletteBridgeParams): PropToolbarViewModel | null {
  const propPlaceables = placeables.filter(isPropEntityPlaceable);
  if (propPlaceables.length === 0) {
    return null;
  }

  return {
    groups: groupPlaceablesByGroup(propPlaceables),
    onDragStart(event, placeable) {
      startPlaceableDrag(event, placeable);
    },
  };
}

export { isPropEntityPlaceable };
