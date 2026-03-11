import type { PlaceTerrainDropPayload, TerrainTileInspectedPayload } from "../events";
import type { TerrainRenderTile } from "./contracts";
import { resolveTerrainEditMaterial } from "./editPolicy";
import { TerrainGameplayGrid } from "./gameplayGrid";
import { TerrainMapStore } from "./store";
import { TerrainTileResolver } from "./tileResolver";

const PREVIEW_RENDER_NEIGHBOR_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
] as const;

export class TerrainQueries {
  constructor(
    private readonly store: TerrainMapStore,
    private readonly gameplayGrid: TerrainGameplayGrid,
    private readonly tileResolver: TerrainTileResolver,
  ) {}

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

    const previewMaterialId = resolveTerrainEditMaterial(payload, this.store.defaultMaterial);
    const materialAt = (cellX: number, cellY: number) =>
      cellX === center.cellX && cellY === center.cellY
        ? previewMaterialId
        : this.store.getCellMaterial(cellX, cellY);

    const tiles: TerrainRenderTile[] = [];
    for (const offset of PREVIEW_RENDER_NEIGHBOR_OFFSETS) {
      const cellX = center.cellX + offset.x;
      const cellY = center.cellY + offset.y;
      if (!this.gameplayGrid.isCellInBounds(cellX, cellY)) continue;

      tiles.push(this.tileResolver.resolveRenderTile(materialAt, cellX, cellY));
    }

    return tiles;
  }

  public inspectAtWorld(worldX: number, worldY: number): TerrainTileInspectedPayload | null {
    const cell = this.gameplayGrid.worldToRenderCell(worldX, worldY);
    if (!cell) return null;

    const materialAt = (cellX: number, cellY: number) => this.store.getCellMaterial(cellX, cellY);
    const materialId = materialAt(cell.cellX, cell.cellY);
    return this.tileResolver.resolveInspectedTile(
      materialAt,
      cell.cellX,
      cell.cellY,
      materialId,
    );
  }
}
