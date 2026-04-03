import type { PlaceableViewModel } from "../../../game/contracts/runtime";
import type { EntityToolbarViewModel } from "../contracts";
import {
  groupPlaceablesByGroup,
  isEntityPlaceable,
  startPlaceableDrag,
} from "./placeablesBridge";
import { isPropEntityPlaceable } from "./toolbarPropPaletteBridge";

type CreateToolbarEntityPaletteBridgeParams = {
  placeables: PlaceableViewModel[];
};

export function createToolbarEntityPaletteBridge({
  placeables,
}: CreateToolbarEntityPaletteBridgeParams): EntityToolbarViewModel | null {
  const entityPlaceables = placeables.filter(
    (placeable) =>
      isEntityPlaceable(placeable) && !isPropEntityPlaceable(placeable),
  );
  if (entityPlaceables.length === 0) {
    return null;
  }

  return {
    groups: groupPlaceablesByGroup(entityPlaceables),
    onDragStart(event, placeable) {
      startPlaceableDrag(event, placeable);
    },
  };
}
