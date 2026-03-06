import type { PlaceTerrainDropPayload } from "../events";
import { TERRAIN_CELL_WORLD_SIZE, type TerrainEditOp } from "./contracts";

export class TerrainEditRouter {
  public toEditOp(payload: PlaceTerrainDropPayload, worldX: number, worldY: number): TerrainEditOp {
    const cellX = Math.floor(worldX / TERRAIN_CELL_WORLD_SIZE);
    const cellY = Math.floor(worldY / TERRAIN_CELL_WORLD_SIZE);

    return {
      materialId: payload.materialId,
      brushId: payload.brushId,
      center: {
        cellX,
        cellY,
      },
    };
  }
}
