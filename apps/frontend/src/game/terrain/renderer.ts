import Phaser from "phaser";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_DEPTH,
  TERRAIN_TEXTURE_KEY,
  type TerrainChunkId,
  type TerrainChunkRenderPayload,
  type TerrainGridSpec,
} from "./contracts";

export class TerrainRenderer {
  private readonly chunkContainers = new Map<TerrainChunkId, Phaser.GameObjects.Container>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: TerrainGridSpec,
    private readonly textureKey: string = TERRAIN_TEXTURE_KEY,
  ) {}

  public applyChunkPayload(payload: TerrainChunkRenderPayload): void {
    const existing = this.chunkContainers.get(payload.id);
    if (existing) {
      existing.destroy(true);
      this.chunkContainers.delete(payload.id);
    }

    const chunkStartX = payload.chunkX * this.grid.chunkSize;
    const chunkStartY = payload.chunkY * this.grid.chunkSize;

    const container = this.scene.add.container(
      chunkStartX * TERRAIN_CELL_WORLD_SIZE,
      chunkStartY * TERRAIN_CELL_WORLD_SIZE,
    );
    container.setDepth(TERRAIN_RENDER_DEPTH);

    for (const tile of payload.tiles) {
      const localCellX = tile.cellX - chunkStartX;
      const localCellY = tile.cellY - chunkStartY;
      const image = this.scene.make.image({
        x: localCellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
        y: localCellY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
        key: this.textureKey,
        frame: tile.frame,
        add: false,
      });

      image.setScale(TERRAIN_CELL_WORLD_SIZE / image.width);
      image.setRotation(tile.rotate90 * (Math.PI / 2));
      image.setFlip(tile.flipX, tile.flipY);

      container.add(image);
    }

    this.chunkContainers.set(payload.id, container);
  }

  public destroy(): void {
    for (const container of this.chunkContainers.values()) {
      container.destroy(true);
    }
    this.chunkContainers.clear();
  }
}
