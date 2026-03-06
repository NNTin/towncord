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
  private readonly chunkTextures = new Map<TerrainChunkId, Phaser.GameObjects.RenderTexture>();
  private scratchImage: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: TerrainGridSpec,
    private readonly textureKey: string = TERRAIN_TEXTURE_KEY,
  ) {}

  private getScratchImage(): Phaser.GameObjects.Image {
    if (!this.scratchImage) {
      this.scratchImage = this.scene.make.image({ key: this.textureKey, add: false });
    }
    return this.scratchImage;
  }

  public applyChunkPayload(payload: TerrainChunkRenderPayload): void {
    const chunkPixelSize = this.grid.chunkSize * TERRAIN_CELL_WORLD_SIZE;
    const chunkStartX = payload.chunkX * this.grid.chunkSize;
    const chunkStartY = payload.chunkY * this.grid.chunkSize;

    let rt = this.chunkTextures.get(payload.id);
    if (!rt) {
      rt = this.scene.add.renderTexture(
        chunkStartX * TERRAIN_CELL_WORLD_SIZE,
        chunkStartY * TERRAIN_CELL_WORLD_SIZE,
        chunkPixelSize,
        chunkPixelSize,
      );
      rt.setDepth(TERRAIN_RENDER_DEPTH);
      rt.setOrigin(0, 0);
      this.chunkTextures.set(payload.id, rt);
    }

    rt.clear();

    const scratch = this.getScratchImage();

    rt.beginDraw();
    for (const tile of payload.tiles) {
      const localCellX = tile.cellX - chunkStartX;
      const localCellY = tile.cellY - chunkStartY;

      scratch.setTexture(this.textureKey, tile.frame);
      scratch.setScale(TERRAIN_CELL_WORLD_SIZE / scratch.width);
      scratch.setRotation(tile.rotate90 * (Math.PI / 2));
      scratch.setFlip(tile.flipX, tile.flipY);
      scratch.setPosition(
        localCellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
        localCellY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
      );

      rt.batchDraw(scratch);
    }
    rt.endDraw();
  }

  public destroy(): void {
    for (const rt of this.chunkTextures.values()) {
      rt.destroy();
    }
    this.chunkTextures.clear();
    this.scratchImage?.destroy();
    this.scratchImage = null;
  }
}
