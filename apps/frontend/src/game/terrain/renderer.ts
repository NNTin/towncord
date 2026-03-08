import Phaser from "phaser";
import {
  TERRAIN_ANIMATION_FRAME_MS,
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_DEPTH,
  TERRAIN_TEXTURE_KEY,
  type TerrainChunkId,
  type TerrainChunkRenderPayload,
  type TerrainGridSpec,
  type TerrainRenderTile,
} from "./contracts";

type ChunkRenderState = {
  chunkId: TerrainChunkId;
  chunkStartX: number;
  chunkStartY: number;
  staticRT: Phaser.GameObjects.RenderTexture;
  animatedRT: Phaser.GameObjects.RenderTexture | null;
  staticTiles: TerrainRenderTile[];
  animatedTiles: TerrainRenderTile[];
};

export class TerrainRenderer {
  private readonly chunkStates = new Map<TerrainChunkId, ChunkRenderState>();
  private readonly animatedFrameVariantsByBase = new Map<string, string[]>();
  private readonly animatedBaseFrameByName = new Map<string, boolean>();
  private visibleChunkIds = new Set<TerrainChunkId>();
  private scratchImage: Phaser.GameObjects.Image | null = null;
  private phaseTick = 0;

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
    }

    this.animatedFrameVariantsByBase.set(baseFrame, variants);
    return variants;
  }

  private isAnimatedBaseFrame(baseFrame: string): boolean {
    const cached = this.animatedBaseFrameByName.get(baseFrame);
    if (cached !== undefined) return cached;

    const variants = this.resolveFrameVariants(baseFrame);
    const isAnimated = variants.length > 1;
    this.animatedBaseFrameByName.set(baseFrame, isAnimated);
    return isAnimated;
  }

  private resolveFrameForCurrentPhase(baseFrame: string): string {
    const variants = this.resolveFrameVariants(baseFrame);
    if (variants.length <= 1) return baseFrame;

    const index = this.phaseTick % variants.length;
    return variants[index] ?? baseFrame;
  }

  private drawTiles(
    rt: Phaser.GameObjects.RenderTexture,
    tiles: TerrainRenderTile[],
    chunkStartX: number,
    chunkStartY: number,
    animatedPhase: boolean,
  ): void {
    if (tiles.length === 0) {
      rt.clear();
      return;
    }

    const texture = this.scene.textures.get(this.textureKey);
    const scratch = this.getScratchImage();

    rt.clear();
    rt.beginDraw();
    for (const tile of tiles) {
      const localCellX = tile.cellX - chunkStartX;
      const localCellY = tile.cellY - chunkStartY;
      const frame = animatedPhase ? this.resolveFrameForCurrentPhase(tile.frame) : tile.frame;
      const resolvedFrame = texture.has(frame) ? frame : tile.frame;

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

  private createRenderTexture(
    chunkStartX: number,
    chunkStartY: number,
    depth: number,
  ): Phaser.GameObjects.RenderTexture {
    const chunkPixelSize = this.grid.chunkSize * TERRAIN_CELL_WORLD_SIZE;
    const rt = this.scene.add.renderTexture(
      chunkStartX * TERRAIN_CELL_WORLD_SIZE,
      chunkStartY * TERRAIN_CELL_WORLD_SIZE,
      chunkPixelSize,
      chunkPixelSize,
    );
    rt.setDepth(depth);
    rt.setOrigin(0, 0);
    return rt;
  }

  private setChunkVisibility(state: ChunkRenderState, isVisible: boolean): void {
    state.staticRT.setVisible(isVisible);
    if (state.animatedRT) {
      state.animatedRT.setVisible(isVisible);
    }
  }

  private ensureChunkState(payload: TerrainChunkRenderPayload): ChunkRenderState {
    const chunkStartX = payload.chunkX * this.grid.chunkSize;
    const chunkStartY = payload.chunkY * this.grid.chunkSize;

    const existing = this.chunkStates.get(payload.id);
    if (existing) {
      return existing;
    }

    const state: ChunkRenderState = {
      chunkId: payload.id,
      chunkStartX,
      chunkStartY,
      staticRT: this.createRenderTexture(chunkStartX, chunkStartY, TERRAIN_RENDER_DEPTH),
      animatedRT: null,
      staticTiles: [],
      animatedTiles: [],
    };

    this.chunkStates.set(payload.id, state);
    return state;
  }

  private areSetsEqual(a: Set<TerrainChunkId>, b: Set<TerrainChunkId>): boolean {
    if (a.size !== b.size) return false;
    for (const id of a) {
      if (!b.has(id)) return false;
    }
    return true;
  }

  public setVisibleChunkIds(chunkIds: Iterable<TerrainChunkId>): void {
    const next = new Set(chunkIds);
    if (this.areSetsEqual(this.visibleChunkIds, next)) {
      return;
    }

    for (const id of this.visibleChunkIds) {
      if (next.has(id)) continue;
      const state = this.chunkStates.get(id);
      if (!state) continue;
      this.setChunkVisibility(state, false);
    }

    for (const id of next) {
      if (this.visibleChunkIds.has(id)) continue;
      const state = this.chunkStates.get(id);
      if (!state) continue;
      this.setChunkVisibility(state, true);
    }

    this.visibleChunkIds = next;
  }

  public applyChunkPayload(payload: TerrainChunkRenderPayload): void {
    const state = this.ensureChunkState(payload);

    const staticTiles: TerrainRenderTile[] = [];
    const animatedTiles: TerrainRenderTile[] = [];

    for (const tile of payload.tiles) {
      if (this.isAnimatedBaseFrame(tile.frame)) {
        animatedTiles.push(tile);
      } else {
        staticTiles.push(tile);
      }
    }

    state.staticTiles = staticTiles;
    state.animatedTiles = animatedTiles;

    if (state.animatedTiles.length > 0) {
      if (!state.animatedRT) {
        state.animatedRT = this.createRenderTexture(
          state.chunkStartX,
          state.chunkStartY,
          TERRAIN_RENDER_DEPTH + 1,
        );
      }
    } else if (state.animatedRT) {
      state.animatedRT.destroy();
      state.animatedRT = null;
    }

    this.drawTiles(state.staticRT, state.staticTiles, state.chunkStartX, state.chunkStartY, false);

    if (state.animatedRT) {
      this.drawTiles(state.animatedRT, state.animatedTiles, state.chunkStartX, state.chunkStartY, true);
    }

    this.setChunkVisibility(state, this.visibleChunkIds.has(state.chunkId));
  }

  public updateAnimation(nowMs: number = this.scene.time.now): void {
    const nextPhaseTick = Math.floor(nowMs / TERRAIN_ANIMATION_FRAME_MS);
    if (nextPhaseTick === this.phaseTick) return;

    this.phaseTick = nextPhaseTick;

    for (const chunkId of this.visibleChunkIds) {
      const state = this.chunkStates.get(chunkId);
      if (!state || !state.animatedRT || state.animatedTiles.length === 0) continue;

      this.drawTiles(state.animatedRT, state.animatedTiles, state.chunkStartX, state.chunkStartY, true);
    }
  }

  public destroy(): void {
    for (const state of this.chunkStates.values()) {
      state.staticRT.destroy();
      state.animatedRT?.destroy();
    }

    this.chunkStates.clear();
    this.animatedFrameVariantsByBase.clear();
    this.animatedBaseFrameByName.clear();
    this.visibleChunkIds.clear();
    this.scratchImage?.destroy();
    this.scratchImage = null;
    this.phaseTick = 0;
  }
}
