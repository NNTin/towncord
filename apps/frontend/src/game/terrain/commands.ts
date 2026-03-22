import type { PlaceTerrainDropPayload } from "../protocol";
import type { TerrainCellCoord, TerrainEditOp } from "./contracts";
import { TerrainEditRouter } from "./editRouter";
import { TerrainGameplayGrid } from "./gameplayGrid";
import { TerrainMapStore } from "./store";

type QueuedTerrainDrop = {
  payload: PlaceTerrainDropPayload;
  worldX: number;
  worldY: number;
};

type TerrainEditErrorHandler = (error: unknown) => void;

export class TerrainCommands {
  private readonly pendingDrops: QueuedTerrainDrop[] = [];

  constructor(
    private readonly router: TerrainEditRouter,
    private readonly store: TerrainMapStore,
    private readonly gameplayGrid: TerrainGameplayGrid,
  ) {}

  public queueDrop(payload: PlaceTerrainDropPayload, worldX: number, worldY: number): void {
    this.pendingDrops.push({ payload, worldX, worldY });
  }

  public applyDrop(
    payload: PlaceTerrainDropPayload,
    worldX: number,
    worldY: number,
  ): TerrainCellCoord | null {
    return this.applyEditOp(this.router.toEditOp(payload, worldX, worldY));
  }

  public applyEditOp(op: TerrainEditOp): TerrainCellCoord | null {
    return this.store.applyEditOp(op) ? op.center : null;
  }

  public flushPendingDrops(onError?: TerrainEditErrorHandler): TerrainCellCoord[] {
    if (this.pendingDrops.length === 0) return [];

    const changedCells: TerrainCellCoord[] = [];
    try {
      for (const pending of this.pendingDrops) {
        try {
          const changed = this.applyDrop(pending.payload, pending.worldX, pending.worldY);
          if (changed) {
            changedCells.push(changed);
          }
        } catch (error) {
          if (!onError) {
            throw error;
          }
          onError(error);
        }
      }

      return changedCells;
    } finally {
      this.gameplayGrid.notifyCellsChanged(changedCells);
      this.pendingDrops.length = 0;
    }
  }

  public clearPendingDrops(): void {
    this.pendingDrops.length = 0;
  }
}
