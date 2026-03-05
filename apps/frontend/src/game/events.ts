import type { EntityId } from "./domain/model";

// Drag-and-drop placement: React → Phaser
export const PLACE_DRAG_MIME = "application/json";
export const PLACE_OBJECT_DROP_EVENT = "placeObjectDrop";
export const PLAYER_PLACED_EVENT = "playerPlaced";
export const PLAYER_STATE_CHANGED_EVENT = "playerStateChanged";

export type PlaceDragPayload = {
  entityId: EntityId;
};

export type PlaceObjectDropPayload = {
  entityId: EntityId;
  screenX: number;
  screenY: number;
};

export type PlayerPlacedPayload = { worldX: number; worldY: number };

export type PlayerStateChangedPayload = { state: "idle" | "walk" | "run" };
