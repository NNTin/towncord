import type Phaser from "phaser";
import type { PlaceTerrainDropPayload, TerrainTileInspectedPayload } from "../events";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_TEXTURE_KEY,
  toTerrainChunkId,
  type TerrainCellCoord,
  type TerrainChunkId,
  type TerrainMaterialId,
  type TerrainRenderTile,
} from "./contracts";
import { TerrainCaseMapper } from "./caseMapper";
import { TerrainChunkBuilder } from "./chunkBuilder";
import { loadTerrainBootstrap, validateTerrainBootstrap } from "./bootstrap";
import { TerrainEditRouter } from "./editRouter";
import {
  DEFAULT_TERRAIN_MATERIAL_RULES,
  TerrainGameplayGrid,
} from "./gameplayGrid";
import { MarchingSquaresKernel } from "./marchingSquaresKernel";
import { TerrainRenderer } from "./renderer";
import { TerrainMapStore } from "./store";

const PREVIEW_RENDER_NEIGHBOR_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
] as const;

export class TerrainSystem {
  private readonly store: TerrainMapStore;
  private readonly router = new TerrainEditRouter();
  private readonly kernel = new MarchingSquaresKernel();
  private readonly mapper: TerrainCaseMapper;
  private readonly chunkBuilder: TerrainChunkBuilder;
  private readonly renderer: TerrainRenderer;
  private readonly insideMaterial: TerrainMaterialId;
  private readonly gameplayGrid: TerrainGameplayGrid;

  private readonly pendingDrops: Array<{ payload: PlaceTerrainDropPayload; worldX: number; worldY: number }> =
    [];

  constructor(private readonly scene: Phaser.Scene) {
    const bootstrap = loadTerrainBootstrap();
    validateTerrainBootstrap(this.scene, bootstrap);

    this.store = new TerrainMapStore(bootstrap.gridSpec);
    this.mapper = new TerrainCaseMapper(bootstrap.transition.rules);
    this.insideMaterial = bootstrap.transition.insideMaterial;
    this.chunkBuilder = new TerrainChunkBuilder(
      this.store,
      this.kernel,
      this.mapper,
      this.insideMaterial,
    );
    this.renderer = new TerrainRenderer(this.scene, bootstrap.gridSpec);
    this.gameplayGrid = new TerrainGameplayGrid(this.store, DEFAULT_TERRAIN_MATERIAL_RULES);
  }

  public queueDrop(payload: PlaceTerrainDropPayload, worldX: number, worldY: number): void {
    this.pendingDrops.push({ payload, worldX, worldY });
  }

  public getGameplayGrid(): TerrainGameplayGrid {
    return this.gameplayGrid;
  }

  public previewPaintAtWorld(
    payload: PlaceTerrainDropPayload,
    worldX: number,
    worldY: number,
  ): TerrainRenderTile[] | null {
    const center = this.gameplayGrid.worldToCell(worldX, worldY);
    if (!center) return null;

    const previewMaterialId =
      payload.brushId === "delete" || payload.brushId === "eraser"
        ? this.store.defaultMaterial
        : payload.materialId;

    const materialAt = (cellX: number, cellY: number): TerrainMaterialId =>
      cellX === center.cellX && cellY === center.cellY
        ? previewMaterialId
        : this.store.getCellMaterial(cellX, cellY);

    const tiles: TerrainRenderTile[] = [];
    for (const offset of PREVIEW_RENDER_NEIGHBOR_OFFSETS) {
      const cellX = center.cellX + offset.x;
      const cellY = center.cellY + offset.y;
      if (!this.gameplayGrid.isCellInBounds(cellX, cellY)) continue;

      const caseId = this.kernel.deriveCaseId(materialAt, cellX, cellY, this.insideMaterial);
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

    return tiles;
  }

  public update(): void {
    this.renderer.setVisibleChunkIds(this.resolveVisibleChunkIds());

    if (this.pendingDrops.length > 0) {
      const changedCells: TerrainCellCoord[] = [];
      try {
        for (const pending of this.pendingDrops) {
          const op = this.router.toEditOp(pending.payload, pending.worldX, pending.worldY);
          try {
            const changed = this.store.applyEditOp(op);
            if (changed) {
              changedCells.push(op.center);
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              throw error;
            }
            console.error(error);
          }
        }
      } finally {
        this.gameplayGrid.notifyCellsChanged(changedCells);
        this.pendingDrops.length = 0;
      }
    }

    if (!this.store.hasDirtyChunks()) {
      this.renderer.updateAnimation();
      return;
    }

    const dirtyChunks = this.store.consumeDirtyChunks();
    for (const chunk of dirtyChunks) {
      const payload = this.chunkBuilder.buildChunkPayload(chunk);
      this.renderer.applyChunkPayload(payload);
    }

    this.renderer.updateAnimation();
  }

  private resolveVisibleChunkIds(): TerrainChunkId[] {
    const camera = this.scene.cameras.main;
    const worldView = camera.worldView;
    const chunkPixelSize = this.store.chunkSize * TERRAIN_CELL_WORLD_SIZE;

    const minChunkX = 0;
    const minChunkY = 0;
    const maxChunkX = this.store.chunkCountX - 1;
    const maxChunkY = this.store.chunkCountY - 1;

    const margin = 1;
    const startChunkX = Math.max(
      minChunkX,
      Math.floor(worldView.left / chunkPixelSize) - margin,
    );
    const endChunkX = Math.min(
      maxChunkX,
      Math.floor((worldView.right - 1) / chunkPixelSize) + margin,
    );
    const startChunkY = Math.max(
      minChunkY,
      Math.floor(worldView.top / chunkPixelSize) - margin,
    );
    const endChunkY = Math.min(
      maxChunkY,
      Math.floor((worldView.bottom - 1) / chunkPixelSize) + margin,
    );

    const ids: TerrainChunkId[] = [];
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
        ids.push(toTerrainChunkId(chunkX, chunkY));
      }
    }

    return ids;
  }

  public inspectAtWorld(worldX: number, worldY: number): TerrainTileInspectedPayload | null {
    const cellX = Math.floor((worldX - TERRAIN_RENDER_GRID_WORLD_OFFSET) / TERRAIN_CELL_WORLD_SIZE);
    const cellY = Math.floor((worldY - TERRAIN_RENDER_GRID_WORLD_OFFSET) / TERRAIN_CELL_WORLD_SIZE);

    if (cellX < 0 || cellX >= this.store.width || cellY < 0 || cellY >= this.store.height) {
      return null;
    }

    const materialId = this.store.getCellMaterial(cellX, cellY);
    const caseId = this.kernel.deriveCaseId(
      (x, y) => this.store.getCellMaterial(x, y),
      cellX,
      cellY,
      this.insideMaterial,
    );
    const mapped = this.mapper.getRule(caseId);

    return {
      textureKey: TERRAIN_TEXTURE_KEY,
      frame: mapped.frame,
      cellX,
      cellY,
      materialId,
      caseId,
      rotate90: mapped.rotate90 ?? 0,
      flipX: mapped.flipX ?? false,
      flipY: mapped.flipY ?? false,
    };
  }

  public destroy(): void {
    this.pendingDrops.length = 0;
    this.renderer.destroy();
  }
}
