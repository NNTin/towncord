import type { EntityId } from "./domain/model";
import type { TerrainBrushId, TerrainMaterialId } from "./terrain/contracts";

// Drag-and-drop placement: React → Phaser
export const PLACE_DRAG_MIME = "application/json";
export const PLACE_OBJECT_DROP_EVENT = "placeObjectDrop";
export const PLACE_TERRAIN_DROP_EVENT = "placeTerrainDrop";
export const PLAYER_PLACED_EVENT = "playerPlaced";
export const PLAYER_STATE_CHANGED_EVENT = "playerStateChanged";

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

export type LegacyPlaceDragPayload = {
  entityId: EntityId;
};

export type PlaceEntityDropPayload = PlaceEntityDragPayload & {
  entityId: EntityId;
  screenX: number;
  screenY: number;
};

export type PlaceTerrainDropPayload = PlaceTerrainDragPayload & {
  screenX: number;
  screenY: number;
};

export type PlaceDropPayload = PlaceEntityDropPayload | PlaceTerrainDropPayload;

// Kept for entity placement compatibility while terrain drops use PLACE_TERRAIN_DROP_EVENT.
export type PlaceObjectDropPayload = PlaceEntityDropPayload;

export type PlayerPlacedPayload = { worldX: number; worldY: number };

export type PlayerStateChangedPayload = { state: "idle" | "walk" | "run" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
