import Phaser from "phaser";
import {
  DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_ANIMATED_DEPTH,
  TERRAIN_STATIC_DEPTH,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_TEXTURE_KEY,
  type TerrainChunkId,
  type TerrainChunkRenderPayload,
  type TerrainGridSpec,
  type TerrainRenderTile,
} from "./contracts";
import { TerrainAnimationClock } from "./animationClock";
import type { TerrainRenderSurface } from "./renderSurface";

type ChunkRenderState = {
  chunkId: TerrainChunkId;
  chunkStartX: number;
  chunkStartY: number;
  staticRT: Phaser.GameObjects.RenderTexture;
  animatedRT: Phaser.GameObjects.RenderTexture | null;
  staticTiles: TerrainRenderTile[];
  animatedTiles: TerrainRenderTile[];
};

const BASE_FRAME_CASE_SUFFIX_RE = /#[0-9]+$/;

export function getTerrainAnimationId(baseFrame: string): string {
  return baseFrame.replace(BASE_FRAME_CASE_SUFFIX_RE, "");
}

export function normalizeTerrainPhaseDurations(
  durationsMs: readonly number[] | undefined,
  variantCount: number,
  fallbackDurationMs: number = DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
): number[] {
  if (variantCount <= 0) {
    return [];
  }

  if (
    Array.isArray(durationsMs) &&
    durationsMs.length > 0 &&
    durationsMs.every((duration) => Number.isInteger(duration) && duration > 0)
  ) {
    const normalized = durationsMs.slice(0, variantCount);
    while (normalized.length < variantCount) {
      normalized.push(fallbackDurationMs);
    }
    return normalized;
  }

  return Array.from({ length: variantCount }, () => fallbackDurationMs);
}

export function resolveTerrainPhaseIndex(
  nowMs: number,
  durationsMs: readonly number[],
): number {
  if (durationsMs.length === 0) {
    return 0;
  }

  const cycleDurationMs = durationsMs.reduce(
    (total, duration) => total + duration,
    0,
  );
  if (cycleDurationMs <= 0) {
    return 0;
  }

  let offsetMs =
    ((Math.floor(nowMs) % cycleDurationMs) + cycleDurationMs) % cycleDurationMs;
  for (const [index, duration] of durationsMs.entries()) {
    if (offsetMs < duration) {
      return index;
    }
    offsetMs -= duration;
  }

  return durationsMs.length - 1;
}

export class TerrainRenderer {
  private readonly chunkStates = new Map<TerrainChunkId, ChunkRenderState>();
  private readonly animatedFrameVariantsByBase = new Map<string, string[]>();
  private readonly animatedBaseFrameByName = new Map<string, boolean>();
  private readonly animationClock: TerrainAnimationClock;
  private visibleChunkIds = new Set<TerrainChunkId>();
  private scratchImage: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly scene: TerrainRenderSurface,
    private readonly grid: TerrainGridSpec,
    private readonly textureKey: string = TERRAIN_TEXTURE_KEY,
    animationPhaseDurationsById: Readonly<
      Record<string, readonly number[]>
    > = {},
    fallbackPhaseDurationMs: number = DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  ) {
    this.animationClock = new TerrainAnimationClock(
      animationPhaseDurationsById,
      fallbackPhaseDurationMs,
    );
  }

  private getScratchImage(): Phaser.GameObjects.Image {
    if (!this.scratchImage) {
      this.scratchImage = this.scene.make.image({
        key: this.textureKey,
        add: false,
      });
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
    return this.animationClock.resolveFrame(baseFrame, variants);
  }

  private drawStaticTiles(
    rt: Phaser.GameObjects.RenderTexture,
    tiles: TerrainRenderTile[],
    chunkStartX: number,
    chunkStartY: number,
  ): void {
    this.renderTilesToRT(rt, tiles, chunkStartX, chunkStartY, (frame) => frame);
  }

  private drawAnimatedTiles(
    rt: Phaser.GameObjects.RenderTexture,
    tiles: TerrainRenderTile[],
    chunkStartX: number,
    chunkStartY: number,
  ): void {
    this.renderTilesToRT(rt, tiles, chunkStartX, chunkStartY, (frame) =>
      this.resolveFrameForCurrentPhase(frame),
    );
  }

  private drawTileLayer(
    scratch: Phaser.GameObjects.Image,
    rt: Phaser.GameObjects.RenderTexture,
    frame: string,
    localCellX: number,
    localCellY: number,
    rotate90: 0 | 1 | 2 | 3,
    flipX: boolean,
    flipY: boolean,
  ): void {
    scratch.setTexture(this.textureKey, frame);
    scratch.setScale(TERRAIN_CELL_WORLD_SIZE / scratch.width);
    scratch.setRotation(rotate90 * (Math.PI / 2));
    scratch.setFlip(flipX, flipY);
    scratch.setPosition(
      localCellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
      localCellY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5,
    );

    rt.batchDraw(scratch);
  }

  private renderTilesToRT(
    rt: Phaser.GameObjects.RenderTexture,
    tiles: TerrainRenderTile[],
    chunkStartX: number,
    chunkStartY: number,
    resolveFrame: (baseFrame: string) => string,
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
      if (tile.underlayFrame) {
        const underlayFrame = resolveFrame(tile.underlayFrame);
        const resolvedUnderlayFrame = texture.has(underlayFrame)
          ? underlayFrame
          : tile.underlayFrame;
        this.drawTileLayer(
          scratch,
          rt,
          resolvedUnderlayFrame,
          localCellX,
          localCellY,
          0,
          false,
          false,
        );
      }

      const frame = resolveFrame(tile.frame);
      const resolvedFrame = texture.has(frame) ? frame : tile.frame;
      this.drawTileLayer(
        scratch,
        rt,
        resolvedFrame,
        localCellX,
        localCellY,
        tile.rotate90,
        tile.flipX,
        tile.flipY,
      );
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
      chunkStartX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET,
      chunkStartY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_RENDER_GRID_WORLD_OFFSET,
      chunkPixelSize,
      chunkPixelSize,
    );
    rt.setDepth(depth);
    rt.setOrigin(0, 0);
    return rt;
  }

  private setChunkVisibility(
    state: ChunkRenderState,
    isVisible: boolean,
  ): void {
    state.staticRT.setVisible(isVisible);
    if (state.animatedRT) {
      state.animatedRT.setVisible(isVisible);
    }
  }

  private ensureChunkState(
    payload: TerrainChunkRenderPayload,
  ): ChunkRenderState {
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
      staticRT: this.createRenderTexture(
        chunkStartX,
        chunkStartY,
        TERRAIN_STATIC_DEPTH,
      ),
      animatedRT: null,
      staticTiles: [],
      animatedTiles: [],
    };

    this.chunkStates.set(payload.id, state);
    return state;
  }

  private areSetsEqual(
    a: Set<TerrainChunkId>,
    b: Set<TerrainChunkId>,
  ): boolean {
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
      if (
        this.isAnimatedBaseFrame(tile.frame) ||
        (tile.underlayFrame !== undefined &&
          this.isAnimatedBaseFrame(tile.underlayFrame))
      ) {
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
          TERRAIN_ANIMATED_DEPTH,
        );
      }
    } else if (state.animatedRT) {
      state.animatedRT.destroy();
      state.animatedRT = null;
    }

    this.drawStaticTiles(
      state.staticRT,
      state.staticTiles,
      state.chunkStartX,
      state.chunkStartY,
    );

    if (state.animatedRT) {
      this.drawAnimatedTiles(
        state.animatedRT,
        state.animatedTiles,
        state.chunkStartX,
        state.chunkStartY,
      );
    }

    this.setChunkVisibility(state, this.visibleChunkIds.has(state.chunkId));
  }

  public updateAnimation(nowMs: number = this.scene.time.now): void {
    const visibleAnimatedTileVariants: Array<{
      baseFrame: string;
      variants: string[];
    }> = [];

    for (const chunkId of this.visibleChunkIds) {
      const state = this.chunkStates.get(chunkId);
      if (!state || state.animatedTiles.length === 0) continue;

      for (const tile of state.animatedTiles) {
        const variants = this.resolveFrameVariants(tile.frame);
        if (variants.length <= 1) continue;

        visibleAnimatedTileVariants.push({ baseFrame: tile.frame, variants });
      }
    }

    const changed = this.animationClock.tick(
      nowMs,
      visibleAnimatedTileVariants,
    );
    if (!changed) {
      return;
    }

    for (const chunkId of this.visibleChunkIds) {
      const state = this.chunkStates.get(chunkId);
      if (!state || !state.animatedRT || state.animatedTiles.length === 0)
        continue;

      this.drawAnimatedTiles(
        state.animatedRT,
        state.animatedTiles,
        state.chunkStartX,
        state.chunkStartY,
      );
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
    this.animationClock.clear();
    this.visibleChunkIds.clear();
    this.scratchImage?.destroy();
    this.scratchImage = null;
  }
}
