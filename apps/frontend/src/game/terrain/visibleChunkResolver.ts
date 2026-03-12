import {
  TERRAIN_CELL_WORLD_SIZE,
  type TerrainChunkId,
  type TerrainChunkSize,
  toTerrainChunkId,
} from "./contracts";

type TerrainWorldViewRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export class TerrainVisibleChunkResolver {
  constructor(
    private readonly chunkSize: TerrainChunkSize,
    private readonly chunkCountX: number,
    private readonly chunkCountY: number,
    private readonly margin: number = 1,
  ) {}

  public resolveVisibleChunkIds(worldView: TerrainWorldViewRect): TerrainChunkId[] {
    const chunkPixelSize = this.chunkSize * TERRAIN_CELL_WORLD_SIZE;

    const minChunkX = 0;
    const minChunkY = 0;
    const maxChunkX = this.chunkCountX - 1;
    const maxChunkY = this.chunkCountY - 1;

    const startChunkX = Math.max(
      minChunkX,
      Math.floor(worldView.left / chunkPixelSize) - this.margin,
    );
    const endChunkX = Math.min(
      maxChunkX,
      Math.floor((worldView.right - 1) / chunkPixelSize) + this.margin,
    );
    const startChunkY = Math.max(
      minChunkY,
      Math.floor(worldView.top / chunkPixelSize) - this.margin,
    );
    const endChunkY = Math.min(
      maxChunkY,
      Math.floor((worldView.bottom - 1) / chunkPixelSize) + this.margin,
    );

    const ids: TerrainChunkId[] = [];
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
        ids.push(toTerrainChunkId(chunkX, chunkY));
      }
    }

    return ids;
  }
}
