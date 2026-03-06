import type Phaser from "phaser";
import type { PlaceTerrainDropPayload, TerrainTileInspectedPayload } from "../events";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_TEXTURE_KEY,
  type TerrainMaterialId,
} from "./contracts";
import { TerrainCaseMapper } from "./caseMapper";
import { TerrainChunkBuilder } from "./chunkBuilder";
import { loadTerrainBootstrap, validateTerrainBootstrap } from "./bootstrap";
import { TerrainEditRouter } from "./editRouter";
import { MarchingSquaresKernel } from "./marchingSquaresKernel";
import { TerrainRenderer } from "./renderer";
import { TerrainMapStore } from "./store";

export class TerrainSystem {
  private readonly store: TerrainMapStore;
  private readonly router = new TerrainEditRouter();
  private readonly kernel = new MarchingSquaresKernel();
  private readonly mapper: TerrainCaseMapper;
  private readonly chunkBuilder: TerrainChunkBuilder;
  private readonly renderer: TerrainRenderer;
  private readonly insideMaterial: TerrainMaterialId;

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
  }

  public queueDrop(payload: PlaceTerrainDropPayload, worldX: number, worldY: number): void {
    this.pendingDrops.push({ payload, worldX, worldY });
  }

  public update(): void {
    if (this.pendingDrops.length > 0) {
      for (const pending of this.pendingDrops) {
        const op = this.router.toEditOp(pending.payload, pending.worldX, pending.worldY);
        try {
          this.store.applyEditOp(op);
        } catch (error) {
          if (import.meta.env.DEV) {
            throw error;
          }
          console.error(error);
        }
      }
      this.pendingDrops.length = 0;
    }

    if (!this.store.hasDirtyChunks()) return;

    const dirtyChunks = this.store.consumeDirtyChunks();
    for (const chunk of dirtyChunks) {
      const payload = this.chunkBuilder.buildChunkPayload(chunk);
      this.renderer.applyChunkPayload(payload);
    }
  }

  public inspectAtWorld(worldX: number, worldY: number): TerrainTileInspectedPayload | null {
    const cellX = Math.floor(worldX / TERRAIN_CELL_WORLD_SIZE);
    const cellY = Math.floor(worldY / TERRAIN_CELL_WORLD_SIZE);

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
