import type { TerrainChunkRenderPayload, TerrainChunkState, TerrainMaterialId } from "./contracts";
import { TerrainCaseMapper } from "./caseMapper";
import { MarchingSquaresKernel } from "./marchingSquaresKernel";
import { TerrainMapStore } from "./store";

export class TerrainChunkBuilder {
  constructor(
    private readonly store: TerrainMapStore,
    private readonly kernel: MarchingSquaresKernel,
    private readonly mapper: TerrainCaseMapper,
    private readonly insideMaterial: TerrainMaterialId,
  ) {}

  public buildChunkPayload(chunk: TerrainChunkState): TerrainChunkRenderPayload {
    const tiles: TerrainChunkRenderPayload["tiles"] = [];
    const bounds = this.store.getChunkCellBounds(chunk.chunkX, chunk.chunkY);

    for (let cellY = bounds.startY; cellY < bounds.endY; cellY += 1) {
      for (let cellX = bounds.startX; cellX < bounds.endX; cellX += 1) {
        const caseId = this.kernel.deriveCaseId(
          (x, y) => this.store.getCellMaterial(x, y),
          cellX,
          cellY,
          this.insideMaterial,
        );
        const mapped = this.mapper.getRule(caseId);

        tiles.push({
          cellX,
          cellY,
          caseId,
          frame: mapped.frame,
          rotate90: mapped.rotate90 ?? 0,
          flipX: mapped.flipX ?? false,
          flipY: mapped.flipY ?? false,
        });
      }
    }

    return {
      id: chunk.id,
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      revision: chunk.revision,
      tiles,
    };
  }
}
