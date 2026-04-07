import type { PlaceableViewModel } from "../../../game/contracts/runtime";
import type { EntityToolbarViewModel } from "../contracts";
import { groupPlaceablesByGroup, isEntityPlaceable } from "./placeablesBridge";
import { isPropEntityPlaceable } from "./toolbarPropPaletteBridge";

type CreateToolbarEntityPaletteBridgeParams = {
  placeables: PlaceableViewModel[];
  onSpawnEntity: (entityId: string) => void;
};

export function createToolbarEntityPaletteBridge({
  placeables,
  onSpawnEntity,
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
    onClick(placeable) {
      onSpawnEntity(placeable.entityId);
    },
  };
}
