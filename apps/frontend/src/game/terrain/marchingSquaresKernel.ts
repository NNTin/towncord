import type { TerrainMaterialId } from "./contracts";

export type TerrainMaterialLookup = (cellX: number, cellY: number) => TerrainMaterialId;

// TODO(architecture-review): MarchingSquaresKernel implements the 4-corner (16-case) dual-
// grid variant of marching squares, where case bits are packed as nw|ne<<1|se<<2|sw<<3.
// The kernel is cleanly stateless and well-isolated. One limitation: it only supports a
// binary inside/outside test against a single `insideMaterial`. Multi-material blending
// (e.g. grass-to-sand transitions) would require a priority-ordered marching squares pass
// per material pair, or a different tile-matching strategy. This constraint should be
// documented here so it is visible before extending the terrain material system.
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
