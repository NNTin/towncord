import type { EntityId } from "./domain/model";
import type { OfficeTileColor } from "./office/model";
import type { TerrainBrushId, TerrainMaterialId } from "./terrain/contracts";
import type { OfficeColorAdjust } from "./scenes/office/colors";
import { isRecord } from "./utils/typeGuards";

// React → Phaser commands
export const PLACE_DRAG_MIME = "application/json";
export const PLACE_OBJECT_DROP_EVENT = "placeObjectDrop";
export const PLACE_TERRAIN_DROP_EVENT = "placeTerrainDrop";
export const SELECT_TERRAIN_TOOL_EVENT = "selectTerrainTool";
export const SET_ZOOM_EVENT = "setZoom";
export const OFFICE_SET_EDITOR_TOOL_EVENT = "officeSetEditorTool";

// Phaser → React notifications
export const TERRAIN_TILE_INSPECTED_EVENT = "terrainTileInspected";
export const PLAYER_PLACED_EVENT = "playerPlaced";
export const PLAYER_STATE_CHANGED_EVENT = "playerStateChanged";
export const RUNTIME_PERF_EVENT = "runtimePerf";
export const ZOOM_CHANGED_EVENT = "zoomChanged";
export const OFFICE_FLOOR_PICKED_EVENT = "officeFloorPicked";
export const OFFICE_LAYOUT_CHANGED_EVENT = "officeLayoutChanged";

export type OfficeEditorToolId = "floor" | "wall" | "erase" | "furniture";
export type OfficeFloorMode = "paint" | "pick";

export type OfficeLayoutChangedPayload = {
  layout: import("./scenes/office/bootstrap").OfficeSceneLayout;
};

// Review: Interface Segregation Principle — this payload bundles every tool's
// config into a single flat object. When tool === "furniture", the consumer
// still receives floorMode, tileColor, floorColor, and floorPattern (all null).
// When tool === "floor", furnitureId is carried but irrelevant.
//
// A discriminated union would make each tool's data requirements explicit:
//   type OfficeSetEditorToolPayload =
//     | { tool: "floor"; floorMode: OfficeFloorMode; tileColor: ...; floorColor: ...; floorPattern: ... }
//     | { tool: "wall" }
//     | { tool: "erase" }
//     | { tool: "furniture"; furnitureId: string }
//     | { tool: null }
//
// Benefits: (1) consumers can narrow on `tool` without null-checking irrelevant
// fields, (2) adding a new tool's config won't bloat unrelated variants,
// (3) TypeScript exhaustiveness checking catches missing handlers.
export type OfficeSetEditorToolPayload = {
  tool: OfficeEditorToolId | null;
  floorMode: OfficeFloorMode | null;
  tileColor: OfficeTileColor | null;
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
  furnitureId: string | null;
};

export type OfficeFloorPickedPayload = {
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
};

export type ZoomChangedPayload = { zoom: number; minZoom: number; maxZoom: number };
export type SetZoomPayload = { zoom: number };

export type PlaceEntityDragPayload = {
  type: "entity";
  entityId: EntityId;
};

export type PlaceTerrainDragPayload = {
  type: "terrain";
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
};

export type PlaceDragPayload = PlaceEntityDragPayload | PlaceTerrainDragPayload;


export type PlaceEntityDropPayload = PlaceEntityDragPayload & {

  screenX: number;
  screenY: number;
};

export type PlaceTerrainDropPayload = PlaceTerrainDragPayload & {
  screenX: number;
  screenY: number;
};

type PlaceDropPayload = PlaceEntityDropPayload | PlaceTerrainDropPayload;

// Kept for entity placement compatibility while terrain drops use PLACE_TERRAIN_DROP_EVENT.
export type PlaceObjectDropPayload = PlaceEntityDropPayload;
export type SelectedTerrainToolPayload = {
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
} | null;
export type TerrainTileInspectedPayload = {
  textureKey: string;
  frame: string;
  cellX: number;
  cellY: number;
  materialId: TerrainMaterialId;
  caseId: number;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type PlayerPlacedPayload = { worldX: number; worldY: number };

export type PlayerStateChangedPayload = { state: "idle" | "walk" | "run" };

export type RuntimePerfPayload = {
  timestampMs: number;
  fps: number;
  frameMs: number;
  updateMs: number;
  terrainMs: number;
};

export function parsePlaceDragPayload(
  value: unknown,
): PlaceDragPayload | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  if (type === "entity" && typeof value.entityId === "string") {
    return {
      type,
      entityId: value.entityId,
    };
  }

  if (
    type === "terrain" &&
    typeof value.materialId === "string" &&
    typeof value.brushId === "string"
  ) {
    return {
      type,
      materialId: value.materialId,
      brushId: value.brushId,
    };
  }

  // Backward-compatible legacy payload: { entityId }
  if (typeof value.entityId === "string") {
    return {
      type: "entity",
      entityId: value.entityId,
    };
  }

  return null;
}

export function toPlaceDropPayload(
  payload: PlaceDragPayload,
  screenX: number,
  screenY: number,
): PlaceDropPayload {
  if (payload.type === "entity") {
    return {
      type: "entity",
      entityId: payload.entityId,
      screenX,
      screenY,
    };
  }

  return {
    type: "terrain",
    materialId: payload.materialId,
    brushId: payload.brushId,
    screenX,
    screenY,
  };
}
