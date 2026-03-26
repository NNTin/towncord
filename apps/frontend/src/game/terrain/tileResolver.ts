import type { TerrainTileInspectedPayload } from "../contracts/runtime";
import { TERRAIN_TEXTURE_KEY, type TerrainMaterialId, type TerrainRenderTile } from "./contracts";
import { TerrainCaseMapper } from "./caseMapper";
import { MarchingSquaresKernel, type TerrainMaterialLookup } from "./marchingSquaresKernel";

export class TerrainTileResolver {
  constructor(
    private readonly kernel: MarchingSquaresKernel,
    private readonly mapper: TerrainCaseMapper,
    private readonly insideMaterial: TerrainMaterialId,
  ) {}

  public resolveRenderTile(
    materialAt: TerrainMaterialLookup,
    cellX: number,
    cellY: number,
  ): TerrainRenderTile {
    const caseId = this.kernel.deriveCaseId(materialAt, cellX, cellY, this.insideMaterial);
    const mapped = this.mapper.getRule(caseId);

    return {
      cellX,
      cellY,
      caseId,
      frame: mapped.frame,
      rotate90: mapped.rotate90 ?? 0,
      flipX: mapped.flipX ?? false,
      flipY: mapped.flipY ?? false,
    };
  }

  public resolveInspectedTile(
    materialAt: TerrainMaterialLookup,
    cellX: number,
    cellY: number,
    materialId: TerrainMaterialId,
    textureKey: string = TERRAIN_TEXTURE_KEY,
  ): TerrainTileInspectedPayload {
    const tile = this.resolveRenderTile(materialAt, cellX, cellY);
    return {
      textureKey,
      frame: tile.frame,
      cellX: tile.cellX,
      cellY: tile.cellY,
      materialId,
      caseId: tile.caseId,
      rotate90: tile.rotate90,
      flipX: tile.flipX,
      flipY: tile.flipY,
    };
  }
}
