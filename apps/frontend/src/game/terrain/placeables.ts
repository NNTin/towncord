import type { TerrainBrushId, TerrainMaterialId } from "./contracts";

export type TerrainPlaceableDefinition = {
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
    brushId: "tile",
  },
  {
    id: "terrain.grass.tile",
    label: "Grass Tile Brush",
    materialId: "ground",
    brushId: "tile",
  },
  {
    id: "terrain.eraser",
    label: "Eraser",
    materialId: "ground",
    brushId: "eraser",
  },
];
