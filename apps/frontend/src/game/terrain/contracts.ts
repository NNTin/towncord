export const TERRAIN_CHUNK_SIZE = 32 as const;
export const TERRAIN_TEXTURE_KEY = "bloomseed.tilesets";
export const TERRAIN_TILE_FRAME_SIZE = 16;
export const TERRAIN_TILE_SCALE = 4;
export const TERRAIN_CELL_WORLD_SIZE = TERRAIN_TILE_FRAME_SIZE * TERRAIN_TILE_SCALE;
export const TERRAIN_RENDER_DEPTH = -1_000;

export type TerrainChunkSize = typeof TERRAIN_CHUNK_SIZE;
export type TerrainMaterialId = string;
export type TerrainBrushId = string;

export type TerrainGridSpec = {
  width: number;
  height: number;
  chunkSize: TerrainChunkSize;
  defaultMaterial: TerrainMaterialId;
  materials: TerrainMaterialId[];
  cells: TerrainMaterialId[];
};

export type TerrainChunkCoord = {
  chunkX: number;
  chunkY: number;
};

export type TerrainChunkId = `${number},${number}`;

export type TerrainChunkState = TerrainChunkCoord & {
  id: TerrainChunkId;
  dirty: boolean;
  revision: number;
};

export type TerrainCellCoord = {
  cellX: number;
  cellY: number;
};

export type TerrainEditOp = {
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  center: TerrainCellCoord;
};

export type TerrainRenderTile = {
  cellX: number;
  cellY: number;
  caseId: number;
  frame: string;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type TerrainChunkRenderPayload = TerrainChunkCoord & {
  id: TerrainChunkId;
  revision: number;
  tiles: TerrainRenderTile[];
};

export function toTerrainChunkId(chunkX: number, chunkY: number): TerrainChunkId {
  return `${chunkX},${chunkY}`;
}
