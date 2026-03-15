import {
  type TerrainChunkId,
  type TerrainChunkState,
  type TerrainEditOp,
  type TerrainGridSpec,
  type TerrainMaterialId,
  toTerrainChunkId,
} from "./contracts";
import { resolveTerrainEditMaterial } from "./editPolicy";

const CASE_NEIGHBOR_OFFSETS = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
] as const;

function compareChunkStates(a: TerrainChunkState, b: TerrainChunkState): number {
  if (a.chunkY !== b.chunkY) return a.chunkY - b.chunkY;
  return a.chunkX - b.chunkX;
}

// TODO(architecture-review): TerrainMapStore stores cell data as a string array
// (TerrainMaterialId[]). For large maps this is memory-inefficient — each string reference
// occupies 8 bytes on a 64-bit heap plus the string object itself, vs. 1–2 bytes for a
// typed integer ID. Assign numeric IDs to materials and back the cells array
// with a Uint8Array or Uint16Array for better cache performance and lower GC pressure.
// Additionally, the store supports only one material per cell (single terrain layer). If
// the game ever needs layered terrain (e.g. a ground layer + a detail/decal layer), the
// data model will need to be extended before the rendering pipeline can support it.
export class TerrainMapStore {
  public readonly width: number;
  public readonly height: number;
  public readonly chunkSize: TerrainGridSpec["chunkSize"];
  public readonly defaultMaterial: TerrainMaterialId;
  public readonly chunkCountX: number;
  public readonly chunkCountY: number;

  private readonly materials = new Set<TerrainMaterialId>();
  private readonly cells: TerrainMaterialId[];
  private readonly chunks = new Map<TerrainChunkId, TerrainChunkState>();
  private readonly dirtyChunkIds = new Set<TerrainChunkId>();

  constructor(spec: TerrainGridSpec) {
    this.width = spec.width;
    this.height = spec.height;
    this.chunkSize = spec.chunkSize;
    this.defaultMaterial = spec.defaultMaterial;
    this.cells = [...spec.cells];

    for (const materialId of spec.materials) {
      this.materials.add(materialId);
    }

    this.chunkCountX = Math.ceil(this.width / this.chunkSize);
    this.chunkCountY = Math.ceil(this.height / this.chunkSize);

    for (let chunkY = 0; chunkY < this.chunkCountY; chunkY += 1) {
      for (let chunkX = 0; chunkX < this.chunkCountX; chunkX += 1) {
        const id = toTerrainChunkId(chunkX, chunkY);
        const state: TerrainChunkState = {
          id,
          chunkX,
          chunkY,
          dirty: false,
          revision: 0,
        };
        this.chunks.set(id, state);
        this.markChunkDirty(chunkX, chunkY);
      }
    }
  }

  public hasMaterial(materialId: TerrainMaterialId): boolean {
    return this.materials.has(materialId);
  }

  public hasDirtyChunks(): boolean {
    return this.dirtyChunkIds.size > 0;
  }

  public isInBounds(cellX: number, cellY: number): boolean {
    return cellX >= 0 && cellX < this.width && cellY >= 0 && cellY < this.height;
  }

  public getCellMaterial(cellX: number, cellY: number): TerrainMaterialId {
    if (!this.isInBounds(cellX, cellY)) {
      return this.defaultMaterial;
    }

    return this.cells[this.toCellIndex(cellX, cellY)]!;
  }

  public applyEditOp(op: TerrainEditOp): boolean {
    return this.setCellMaterial(
      op.center.cellX,
      op.center.cellY,
      resolveTerrainEditMaterial(op, this.defaultMaterial),
    );
  }

  public setCellMaterial(cellX: number, cellY: number, materialId: TerrainMaterialId): boolean {
    if (!this.isInBounds(cellX, cellY)) return false;

    if (!this.materials.has(materialId)) {
      throw new Error(`TerrainMapStore: unknown material \"${materialId}\".`);
    }

    const index = this.toCellIndex(cellX, cellY);
    const current = this.cells[index];
    if (current === materialId) return false;

    this.cells[index] = materialId;
    this.markChunksDirtyForCellChange(cellX, cellY);
    return true;
  }

  public consumeDirtyChunks(): TerrainChunkState[] {
    const dirty = [...this.dirtyChunkIds]
      .map((chunkId) => this.chunks.get(chunkId))
      .filter((chunk): chunk is TerrainChunkState => Boolean(chunk))
      .sort(compareChunkStates)
      .map((chunk) => ({ ...chunk }));

    for (const chunkId of this.dirtyChunkIds) {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) continue;
      chunk.dirty = false;
    }

    this.dirtyChunkIds.clear();
    return dirty;
  }

  public getChunkCellBounds(chunkX: number, chunkY: number): {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } {
    const startX = chunkX * this.chunkSize;
    const startY = chunkY * this.chunkSize;

    return {
      startX,
      startY,
      endX: Math.min(startX + this.chunkSize, this.width),
      endY: Math.min(startY + this.chunkSize, this.height),
    };
  }

  private markChunksDirtyForCellChange(cellX: number, cellY: number): void {
    for (const offset of CASE_NEIGHBOR_OFFSETS) {
      const caseCellX = cellX + offset.x;
      const caseCellY = cellY + offset.y;
      if (!this.isInBounds(caseCellX, caseCellY)) continue;
      const chunkX = Math.floor(caseCellX / this.chunkSize);
      const chunkY = Math.floor(caseCellY / this.chunkSize);
      this.markChunkDirty(chunkX, chunkY);
    }
  }

  private markChunkDirty(chunkX: number, chunkY: number): void {
    const chunkId = toTerrainChunkId(chunkX, chunkY);
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return;

    chunk.revision += 1;
    chunk.dirty = true;
    this.dirtyChunkIds.add(chunkId);
  }

  private toCellIndex(cellX: number, cellY: number): number {
    return cellY * this.width + cellX;
  }
}
