import type { TerrainBrushId, TerrainMaterialId } from "./contracts";

export type TerrainPlaceableDefinition = {
  id: string;
  label: string;
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
};

export const TERRAIN_PLACEABLES: TerrainPlaceableDefinition[] = [
  {
    id: "terrain.water.single",
    label: "Water Brush",
    materialId: "water",
    brushId: "single",
  },
];
