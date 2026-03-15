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

/**
 * In-memory store for the terrain cell grid.
 *
 * ### Numeric backing
 * Cells are stored internally as a `Uint16Array` rather than a `string[]`.
 * Each `TerrainMaterialId` (string) is assigned a compact numeric ID on first
 * encounter, starting at 1 (0 is reserved as "unregistered/sentinel"). The
 * `Uint16Array` supports up to 65 535 distinct materials, which is
 * intentionally future-proof for scenarios with many biome variants.
 *
 * All **public** methods continue to accept and return `TerrainMaterialId`
 * (string) values — the numeric conversion is a private implementation detail
 * that is invisible to callers.
 *
 * ### Single-layer limitation
 * The current model stores exactly one material per cell. If layered terrain
 * is ever needed (e.g. a ground layer + a detail/decal layer), the backing
 * array will need to grow to `2 × width × height` (or more) and the public
 * API will need a `layer` parameter before the rendering pipeline can support
 * the extra data.
 */
export class TerrainMapStore {
  public readonly width: number;
  public readonly height: number;
  public readonly chunkSize: TerrainGridSpec["chunkSize"];
  public readonly defaultMaterial: TerrainMaterialId;
  public readonly chunkCountX: number;
  public readonly chunkCountY: number;

  /** All registered material string IDs (used by hasMaterial). */
  private readonly materials = new Set<TerrainMaterialId>();

  /** Forward map: TerrainMaterialId → compact numeric ID (1-based; 0 = unregistered). */
  private readonly materialToNumeric = new Map<TerrainMaterialId, number>();

  /** Reverse map: compact numeric ID → TerrainMaterialId. */
  private readonly numericToMaterial: TerrainMaterialId[] = [];

  /**
   * Uint16Array backing store for cell data.
   * Index = cellY * width + cellX; value = compact numeric material ID.
   */
  private readonly cells: Uint16Array;

  private readonly chunks = new Map<TerrainChunkId, TerrainChunkState>();
  private readonly dirtyChunkIds = new Set<TerrainChunkId>();

  constructor(spec: TerrainGridSpec) {
    this.width = spec.width;
    this.height = spec.height;
    this.chunkSize = spec.chunkSize;
    this.defaultMaterial = spec.defaultMaterial;

    // Build the material registry from the declared materials list first so
    // that IDs are stable regardless of cell ordering.
    for (const materialId of spec.materials) {
      this.materials.add(materialId);
      this.registerMaterial(materialId);
    }

    // Populate the Uint16Array from the incoming string-based cells array.
    this.cells = new Uint16Array(spec.width * spec.height);
    for (let i = 0; i < spec.cells.length; i += 1) {
      const materialId = spec.cells[i]!;
      this.cells[i] = this.getNumericId(materialId);
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

    const numericId = this.cells[this.toCellIndex(cellX, cellY)]!;
    return this.resolveMaterialId(numericId);
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
      throw new Error(`TerrainMapStore: unknown material "${materialId}".`);
    }

    const newNumericId = this.getNumericId(materialId);
    const index = this.toCellIndex(cellX, cellY);
    const currentNumericId = this.cells[index];
    if (currentNumericId === newNumericId) return false;

    this.cells[index] = newNumericId;
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Registers a material string and assigns it a 1-based numeric ID if it has
   * not been seen before. Safe to call multiple times with the same string.
   */
  private registerMaterial(materialId: TerrainMaterialId): void {
    if (this.materialToNumeric.has(materialId)) return;
    // IDs are 1-based; index 0 in numericToMaterial is left empty so that
    // numeric ID 0 can serve as an "unregistered / out-of-bounds" sentinel.
    const numericId = this.numericToMaterial.length + 1;
    this.materialToNumeric.set(materialId, numericId);
    this.numericToMaterial.push(materialId);
  }

  /** Returns the numeric ID for a known material. Throws if unregistered. */
  private getNumericId(materialId: TerrainMaterialId): number {
    const id = this.materialToNumeric.get(materialId);
    if (id === undefined) {
      throw new Error(`TerrainMapStore: material "${materialId}" has no numeric ID (not registered).`);
    }
    return id;
  }

  /** Resolves a numeric ID back to its string material ID. */
  private resolveMaterialId(numericId: number): TerrainMaterialId {
    // numericId 0 means the cell was never written (should not occur after
    // construction, but guard defensively).
    const materialId = this.numericToMaterial[numericId - 1];
    if (materialId === undefined) {
      return this.defaultMaterial;
    }
    return materialId;
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
