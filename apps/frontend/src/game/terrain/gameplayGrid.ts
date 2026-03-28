import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  type TerrainCellCoord,
  type TerrainMaterialId,
} from "./contracts";
import { TerrainMapStore } from "./store";

const BFS_NEIGHBOR_OFFSETS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

type TerrainMaterialRule = {
  walkable: boolean;
};

type TerrainMaterialRules = Partial<Record<TerrainMaterialId, TerrainMaterialRule>>;

type TerrainWorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type TerrainWorldPoint = {
  worldX: number;
  worldY: number;
};

type TerrainPath = {
  cells: TerrainCellCoord[];
  revision: number;
};

export const DEFAULT_TERRAIN_MATERIAL_RULES: TerrainMaterialRules = {
  ground: { walkable: true },
  water: { walkable: false },
};

export class TerrainGameplayGrid {
  private revision = 0;

  constructor(
    private readonly store: TerrainMapStore,
    private readonly materialRules: TerrainMaterialRules = DEFAULT_TERRAIN_MATERIAL_RULES,
  ) {}

  public getRevision(): number {
    return this.revision;
  }

  public getWorldBounds(): TerrainWorldBounds {
    const width = this.store.width * TERRAIN_CELL_WORLD_SIZE;
    const height = this.store.height * TERRAIN_CELL_WORLD_SIZE;
    return {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
      width,
      height,
    };
  }

  public clampWorldPoint(worldX: number, worldY: number): TerrainWorldPoint {
    const bounds = this.getWorldBounds();
    return {
      worldX: Math.min(Math.max(worldX, bounds.minX), bounds.maxX),
      worldY: Math.min(Math.max(worldY, bounds.minY), bounds.maxY),
    };
  }

  public isCellInBounds(cellX: number, cellY: number): boolean {
    return this.store.isInBounds(cellX, cellY);
  }

  public isWorldInBounds(worldX: number, worldY: number): boolean {
    const bounds = this.getWorldBounds();
    return (
      worldX >= bounds.minX &&
      worldX <= bounds.maxX &&
      worldY >= bounds.minY &&
      worldY <= bounds.maxY
    );
  }

  public worldToCell(worldX: number, worldY: number): TerrainCellCoord | null {
    return this.worldToCellWithOffset(worldX, worldY, 0);
  }

  public worldToRenderCell(worldX: number, worldY: number): TerrainCellCoord | null {
    return this.worldToCellWithOffset(worldX, worldY, TERRAIN_RENDER_GRID_WORLD_OFFSET);
  }

  public cellToWorldCenter(cellX: number, cellY: number): TerrainWorldPoint | null {
    if (!this.isCellInBounds(cellX, cellY)) return null;

    return {
      worldX: (cellX + 0.5) * TERRAIN_CELL_WORLD_SIZE,
      worldY: (cellY + 0.5) * TERRAIN_CELL_WORLD_SIZE,
    };
  }

  public isCellWalkable(cellX: number, cellY: number): boolean {
    if (!this.isCellInBounds(cellX, cellY)) return false;

    const materialId = this.store.getCellMaterial(cellX, cellY);
    return this.materialRules[materialId]?.walkable ?? false;
  }

  public isWorldWalkable(worldX: number, worldY: number): boolean {
    const cell = this.worldToCell(worldX, worldY);
    if (!cell) return false;
    return this.isCellWalkable(cell.cellX, cell.cellY);
  }

  public notifyCellsChanged(changedCells: readonly TerrainCellCoord[]): void {
    if (changedCells.length === 0) return;
    this.revision += 1;
  }

  public findPath(
    start: TerrainCellCoord,
    goal: TerrainCellCoord,
    isWalkable?: (cellX: number, cellY: number) => boolean,
  ): TerrainPath | null {
    const cellIsWalkable = isWalkable ?? ((cellX, cellY) => this.isCellWalkable(cellX, cellY));

    if (!cellIsWalkable(start.cellX, start.cellY)) return null;
    if (!cellIsWalkable(goal.cellX, goal.cellY)) return null;

    const startKey = this.toCellKey(start.cellX, start.cellY);
    const goalKey = this.toCellKey(goal.cellX, goal.cellY);
    const queue: TerrainCellCoord[] = [{ ...start }];
    let queueIndex = 0;
    const visited = new Set<string>([startKey]);
    const parentByKey = new Map<string, string | null>([[startKey, null]]);
    const cellByKey = new Map<string, TerrainCellCoord>([[startKey, { ...start }]]);

    while (queueIndex < queue.length) {
      const current = queue[queueIndex++]!;
      const currentKey = this.toCellKey(current.cellX, current.cellY);

      if (currentKey === goalKey) {
        return {
          cells: this.reconstructPath(goalKey, parentByKey, cellByKey),
          revision: this.revision,
        };
      }

      for (const offset of BFS_NEIGHBOR_OFFSETS) {
        const nextX = current.cellX + offset.x;
        const nextY = current.cellY + offset.y;
        const nextKey = this.toCellKey(nextX, nextY);
        if (visited.has(nextKey) || !cellIsWalkable(nextX, nextY)) continue;

        visited.add(nextKey);
        parentByKey.set(nextKey, currentKey);
        cellByKey.set(nextKey, { cellX: nextX, cellY: nextY });
        queue.push({ cellX: nextX, cellY: nextY });
      }
    }

    return null;
  }

  private reconstructPath(
    goalKey: string,
    parentByKey: ReadonlyMap<string, string | null>,
    cellByKey: ReadonlyMap<string, TerrainCellCoord>,
  ): TerrainCellCoord[] {
    const path: TerrainCellCoord[] = [];
    let currentKey: string | null = goalKey;

    while (currentKey) {
      const cell = cellByKey.get(currentKey);
      if (!cell) break;
      path.push(cell);
      currentKey = parentByKey.get(currentKey) ?? null;
    }

    path.reverse();
    return path;
  }

  private toCellKey(cellX: number, cellY: number): string {
    return `${cellX},${cellY}`;
  }

  private worldToCellWithOffset(
    worldX: number,
    worldY: number,
    worldOffset: number,
  ): TerrainCellCoord | null {
    const cellX = Math.floor((worldX - worldOffset) / TERRAIN_CELL_WORLD_SIZE);
    const cellY = Math.floor((worldY - worldOffset) / TERRAIN_CELL_WORLD_SIZE);
    if (!this.isCellInBounds(cellX, cellY)) return null;

    return { cellX, cellY };
  }
}
