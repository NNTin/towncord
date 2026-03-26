import { TERRAIN_PLACEABLES } from "../terrain/placeables";
import type { TerrainPlaceableViewModel } from "../contracts/runtime";

export function listTerrainPlaceables(): TerrainPlaceableViewModel[] {
  return TERRAIN_PLACEABLES.map((placeable) => ({
    id: placeable.id,
    type: "terrain",
    label: placeable.label,
    materialId: placeable.materialId,
    brushId: placeable.brushId,
    groupKey: "terrain",
    groupLabel: "Terrain",
  }));
}
