import type { TerrainBrushId, TerrainMaterialId } from "./contracts";

type TerrainPlaceableDefinition = {
  id: string;
  label: string;
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
};

export const TERRAIN_PLACEABLES: TerrainPlaceableDefinition[] = [
  {
    id: "terrain.water.tile",
    label: "Water Tile Brush",
    materialId: "water",
    brushId: "water",
  },
  {
    id: "terrain.ground.tile",
    label: "Ground Tile Brush",
    materialId: "ground",
    brushId: "ground",
  },
  {
    id: "terrain.delete",
    label: "Delete Brush",
    materialId: "ground",
    brushId: "delete",
  },
];
