import type { TerrainCellCoord } from "../../terrain";

export class TerrainPaintSession {
  private active = false;
  private readonly paintedCellKeys = new Set<string>();

  public begin(): void {
    this.active = true;
    this.paintedCellKeys.clear();
  }

  public reset(): void {
    this.active = false;
    this.paintedCellKeys.clear();
  }

  public end(): void {
    this.reset();
  }

  public isActive(): boolean {
    return this.active;
  }

  public shouldPaintCell(cell: TerrainCellCoord): boolean {
    if (!this.active) {
      return false;
    }

    const key = `${cell.cellX},${cell.cellY}`;
    if (this.paintedCellKeys.has(key)) {
      return false;
    }

    this.paintedCellKeys.add(key);
    return true;
  }
}
