import {
  DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  TERRAIN_TEXTURE_KEY,
  type TerrainCellCoord,
  type TerrainChunkId,
  type TerrainChunkRenderPayload,
  type TerrainChunkState,
  type TerrainGridSpec,
  type TerrainRenderTile,
} from "./contracts";
import type { TerrainRenderSurface } from "./renderSurface";
import { TerrainRenderer } from "./terrainRenderer";

export type TerrainRuntimeDropPayload = {
  type: "terrain";
  materialId: string;
  brushId: string;
  screenX: number;
  screenY: number;
};

export type TerrainRuntimeTileInspection = {
  textureKey: string;
  frame: string;
  cellX: number;
  cellY: number;
  materialId: string;
  caseId: number;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type TerrainGameplayGridView = {
  getWorldBounds(): { width: number; height: number };
  getRevision(): number;
  worldToCell(worldX: number, worldY: number): TerrainCellCoord | null;
  isCellWalkable(cellX: number, cellY: number): boolean;
  cellToWorldCenter(
    cellX: number,
    cellY: number,
  ): { worldX: number; worldY: number } | null;
  findPath(
    start: TerrainCellCoord,
    goal: TerrainCellCoord,
  ): { cells: TerrainCellCoord[]; revision: number } | null;
  clampWorldPoint(
    worldX: number,
    worldY: number,
  ): { worldX: number; worldY: number };
  isWorldWalkable(worldX: number, worldY: number): boolean;
};

type TerrainRuntimeStore = {
  hasDirtyChunks(): boolean;
  consumeDirtyChunks(): TerrainChunkState[];
};

type TerrainRuntimeChunkBuilder = {
  buildChunkPayload(chunk: TerrainChunkState): TerrainChunkRenderPayload;
};

type TerrainRuntimeCommands = {
  queueDrop(
    payload: TerrainRuntimeDropPayload,
    worldX: number,
    worldY: number,
  ): void;
  flushPendingDrops(onError: (error: unknown) => void): TerrainCellCoord[];
  clearPendingDrops(): void;
};

type TerrainRuntimeQueries = {
  getGameplayGrid(): TerrainGameplayGridView;
  previewPaintAtWorld(
    payload: TerrainRuntimeDropPayload,
    worldX: number,
    worldY: number,
  ): TerrainRenderTile[] | null;
  inspectAtWorld(
    worldX: number,
    worldY: number,
  ): TerrainRuntimeTileInspection | null;
};

type TerrainRuntimeVisibleChunks = {
  resolveVisibleChunkIds(worldView: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }): TerrainChunkId[];
};

export type TerrainRuntimeOptions = {
  gridSpec: TerrainGridSpec;
  store: TerrainRuntimeStore;
  chunkBuilder: TerrainRuntimeChunkBuilder;
  commands: TerrainRuntimeCommands;
  queries: TerrainRuntimeQueries;
  visibleChunks: TerrainRuntimeVisibleChunks;
  onTerrainChanged?: (changedCells: readonly TerrainCellCoord[]) => void;
  textureKey?: string;
  animationPhaseDurationsById?: Readonly<Record<string, readonly number[]>>;
  fallbackPhaseDurationMs?: number;
  staticDepth?: number;
  animatedDepth?: number;
};

export class TerrainRuntime {
  private readonly renderer: TerrainRenderer;
  private readonly textureKey: string;

  constructor(
    private readonly scene: TerrainRenderSurface,
    private readonly options: TerrainRuntimeOptions,
  ) {
    this.textureKey = options.textureKey ?? TERRAIN_TEXTURE_KEY;
    this.renderer = new TerrainRenderer(
      scene,
      options.gridSpec,
      this.textureKey,
      options.animationPhaseDurationsById ?? {},
      options.fallbackPhaseDurationMs ?? DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
      options.staticDepth,
      options.animatedDepth,
    );
  }

  public queueDrop(
    payload: TerrainRuntimeDropPayload,
    worldX: number,
    worldY: number,
  ): void {
    this.options.commands.queueDrop(payload, worldX, worldY);
  }

  public getGameplayGrid(): TerrainGameplayGridView {
    return this.options.queries.getGameplayGrid();
  }

  public getTextureKey(): string {
    return this.textureKey;
  }

  public previewPaintAtWorld(
    payload: TerrainRuntimeDropPayload,
    worldX: number,
    worldY: number,
  ): TerrainRenderTile[] | null {
    return this.options.queries.previewPaintAtWorld(payload, worldX, worldY);
  }

  public update(): void {
    this.renderer.setVisibleChunkIds(
      this.options.visibleChunks.resolveVisibleChunkIds(
        this.scene.cameras.main.worldView,
      ),
    );
    const changedCells = this.options.commands.flushPendingDrops((error) =>
      this.handleEditError(error),
    );
    if (changedCells.length > 0) {
      this.options.onTerrainChanged?.(changedCells);
    }
    this.syncDirtyChunks();
    this.renderer.updateAnimation();
  }

  public inspectAtWorld(
    worldX: number,
    worldY: number,
  ): TerrainRuntimeTileInspection | null {
    return this.options.queries.inspectAtWorld(worldX, worldY);
  }

  public destroy(): void {
    this.options.commands.clearPendingDrops();
    this.renderer.destroy();
  }

  private syncDirtyChunks(): void {
    if (!this.options.store.hasDirtyChunks()) return;

    const dirtyChunks = this.options.store.consumeDirtyChunks();
    for (const chunk of dirtyChunks) {
      const payload = this.options.chunkBuilder.buildChunkPayload(chunk);
      this.renderer.applyChunkPayload(payload);
    }
  }

  private handleEditError(error: unknown): void {
    if (import.meta.env.DEV) {
      throw error;
    }

    console.error(error);
  }
}
