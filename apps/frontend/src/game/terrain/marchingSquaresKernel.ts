import type { TerrainMaterialId } from "./contracts";

export type TerrainMaterialLookup = (cellX: number, cellY: number) => TerrainMaterialId;

export class MarchingSquaresKernel {
  public deriveCaseId(
    materialAt: TerrainMaterialLookup,
    cellX: number,
    cellY: number,
    insideMaterial: TerrainMaterialId,
  ): number {
    const nw = materialAt(cellX, cellY) === insideMaterial ? 1 : 0;
    const ne = materialAt(cellX + 1, cellY) === insideMaterial ? 1 : 0;
    const se = materialAt(cellX + 1, cellY + 1) === insideMaterial ? 1 : 0;
    const sw = materialAt(cellX, cellY + 1) === insideMaterial ? 1 : 0;

    return nw | (ne << 1) | (se << 2) | (sw << 3);
  }
}
