import type { TerrainBrushId, TerrainMaterialId } from "./contracts";

type TerrainBrushMaterial = {
  brushId: TerrainBrushId;
  materialId: TerrainMaterialId;
};

export function resolveTerrainEditMaterial(
  value: TerrainBrushMaterial,
  defaultMaterial: TerrainMaterialId,
): TerrainMaterialId {
  return value.brushId === "delete" || value.brushId === "eraser"
    ? defaultMaterial
    : value.materialId;
}
