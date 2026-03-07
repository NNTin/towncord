import Phaser from "phaser";
import {
  TERRAIN_ANIMATION_FRAME_MS,
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_DEPTH,
  TERRAIN_TEXTURE_KEY,
  type TerrainChunkId,
  type TerrainChunkRenderPayload,
  type TerrainGridSpec,
} from "./contracts";

export class TerrainRenderer {
  private readonly chunkTextures = new Map<TerrainChunkId, Phaser.GameObjects.RenderTexture>();
  private readonly chunkPayloads = new Map<TerrainChunkId, TerrainChunkRenderPayload>();
  private readonly animatedFrameVariantsByBase = new Map<string, string[]>();
  private scratchImage: Phaser.GameObjects.Image | null = null;
  private phaseTick = 0;
  private hasAnimatedFrames = false;

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

  private resolveFrameVariants(baseFrame: string): string[] {
    const cached = this.animatedFrameVariantsByBase.get(baseFrame);
    if (cached) return cached;

    const texture = this.scene.textures.get(this.textureKey);
    const variants: string[] = [];

    if (texture.has(`${baseFrame}@0`)) {
      for (let phase = 0; phase < 256; phase += 1) {
        const phasedFrame = `${baseFrame}@${phase}`;
        if (!texture.has(phasedFrame)) break;
        variants.push(phasedFrame);
      }
    }

    if (variants.length === 0) {
      variants.push(baseFrame);
    } else if (variants.length > 1) {
      this.hasAnimatedFrames = true;
    }

    this.animatedFrameVariantsByBase.set(baseFrame, variants);
    return variants;
  }

  private resolveFrameForCurrentPhase(baseFrame: string): string {
    const variants = this.resolveFrameVariants(baseFrame);
    if (variants.length <= 1) return baseFrame;

    const index = this.phaseTick % variants.length;
    return variants[index] ?? baseFrame;
  }

  private renderChunk(payload: TerrainChunkRenderPayload): void {
    const texture = this.scene.textures.get(this.textureKey);
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
      const phaseFrame = this.resolveFrameForCurrentPhase(tile.frame);
      const resolvedFrame = texture.has(phaseFrame) ? phaseFrame : tile.frame;

      scratch.setTexture(this.textureKey, resolvedFrame);
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

  public applyChunkPayload(payload: TerrainChunkRenderPayload): void {
    this.chunkPayloads.set(payload.id, payload);
    this.renderChunk(payload);
  }

  public updateAnimation(nowMs: number = this.scene.time.now): void {
    if (!this.hasAnimatedFrames || this.chunkPayloads.size === 0) return;

    const nextPhaseTick = Math.floor(nowMs / TERRAIN_ANIMATION_FRAME_MS);
    if (nextPhaseTick === this.phaseTick) return;

    this.phaseTick = nextPhaseTick;

    for (const payload of this.chunkPayloads.values()) {
      this.renderChunk(payload);
    }
  }

  public destroy(): void {
    for (const rt of this.chunkTextures.values()) {
      rt.destroy();
    }
    this.chunkTextures.clear();
    this.chunkPayloads.clear();
    this.animatedFrameVariantsByBase.clear();
    this.scratchImage?.destroy();
    this.scratchImage = null;
    this.hasAnimatedFrames = false;
    this.phaseTick = 0;
  }
}
