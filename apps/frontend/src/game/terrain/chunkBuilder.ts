import type { TerrainChunkRenderPayload, TerrainChunkState } from "./contracts";
import { TerrainMapStore } from "./store";
import { TerrainTileResolver } from "./tileResolver";

export class TerrainChunkBuilder {
  constructor(
    private readonly store: TerrainMapStore,
    private readonly tileResolver: TerrainTileResolver,
  ) {}

  public buildChunkPayload(chunk: TerrainChunkState): TerrainChunkRenderPayload {
    const tiles: TerrainChunkRenderPayload["tiles"] = [];
    const bounds = this.store.getChunkCellBounds(chunk.chunkX, chunk.chunkY);
    const materialAt = (cellX: number, cellY: number) => this.store.getCellMaterial(cellX, cellY);

    for (let cellY = bounds.startY; cellY < bounds.endY; cellY += 1) {
      for (let cellX = bounds.startX; cellX < bounds.endX; cellX += 1) {
        tiles.push(this.tileResolver.resolveRenderTile(materialAt, cellX, cellY));
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
