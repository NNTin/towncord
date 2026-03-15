import type { PlaceTerrainDropPayload, TerrainTileInspectedPayload } from "../events";
import type { TerrainRenderTile } from "./contracts";
import { TerrainChunkBuilder } from "./chunkBuilder";
import { TerrainCommands } from "./commands";
import { TerrainGameplayGrid } from "./gameplayGrid";
import { TerrainQueries } from "./queries";
import { TerrainRenderer } from "./renderer";
import type { TerrainRenderSurface } from "./renderSurface";
import { createTerrainRuntime } from "./runtime";
import { TerrainMapStore } from "./store";
import { TerrainVisibleChunkResolver } from "./visibleChunkResolver";

export class TerrainSystem {
  private readonly store: TerrainMapStore;
  private readonly chunkBuilder: TerrainChunkBuilder;
  private readonly renderer: TerrainRenderer;
  private readonly commands: TerrainCommands;
  private readonly queries: TerrainQueries;
  private readonly visibleChunks: TerrainVisibleChunkResolver;

  constructor(private readonly scene: TerrainRenderSurface) {
    const runtime = createTerrainRuntime(this.scene);
    this.store = runtime.store;
    this.chunkBuilder = runtime.chunkBuilder;
    this.renderer = runtime.renderer;
    this.commands = runtime.commands;
    this.queries = runtime.queries;
    this.visibleChunks = runtime.visibleChunks;
  }

  public queueDrop(payload: PlaceTerrainDropPayload, worldX: number, worldY: number): void {
    this.commands.queueDrop(payload, worldX, worldY);
  }

  public getGameplayGrid(): TerrainGameplayGrid {
    return this.queries.getGameplayGrid();
  }

  public previewPaintAtWorld(
    payload: PlaceTerrainDropPayload,
    worldX: number,
    worldY: number,
  ): TerrainRenderTile[] | null {
    return this.queries.previewPaintAtWorld(payload, worldX, worldY);
  }

  public update(): void {
    this.renderer.setVisibleChunkIds(
      this.visibleChunks.resolveVisibleChunkIds(this.scene.cameras.main.worldView),
    );
    this.commands.flushPendingDrops((error) => this.handleEditError(error));
    this.syncDirtyChunks();
    this.renderer.updateAnimation();
  }

  public inspectAtWorld(worldX: number, worldY: number): TerrainTileInspectedPayload | null {
    return this.queries.inspectAtWorld(worldX, worldY);
  }

  public destroy(): void {
    this.commands.clearPendingDrops();
    this.renderer.destroy();
  }

  private syncDirtyChunks(): void {
    if (!this.store.hasDirtyChunks()) return;

    const dirtyChunks = this.store.consumeDirtyChunks();
    for (const chunk of dirtyChunks) {
      const payload = this.chunkBuilder.buildChunkPayload(chunk);
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
