import type {
  PlaceDragPayload,
  PlaceDropPayload,
  PlaceEntityDropPayload,
  PlaceTerrainDropPayload,
} from "../../contracts/runtime";
import { isRecord } from "../../utils/typeGuards";

export const PLACE_DRAG_MIME = "application/json";

export type {
  PlaceDragPayload,
  PlaceDropPayload,
  PlaceEntityDragPayload,
  PlaceEntityDropPayload,
  PlaceTerrainDragPayload,
  PlaceTerrainDropPayload,
} from "../../contracts/runtime";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePlaceDragPayloadInternal(
  value: unknown,
): PlaceDragPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.type === "entity" && typeof value.entityId === "string") {
    return {
      type: "entity",
      entityId: value.entityId,
    };
  }

  if (
    value.type === "terrain" &&
    typeof value.materialId === "string" &&
    typeof value.brushId === "string"
  ) {
    return {
      type: "terrain",
      materialId: value.materialId,
      brushId: value.brushId,
    };
  }

  return undefined;
}

export function parsePlaceDragPayload(value: unknown): PlaceDragPayload | null {
  return normalizePlaceDragPayloadInternal(value) ?? null;
}

export function parsePlaceDragMimePayload(
  rawPayload: string,
): PlaceDragPayload | null {
  try {
    return parsePlaceDragPayload(JSON.parse(rawPayload));
  } catch {
    return null;
  }
}

export function serializePlaceDragPayload(payload: PlaceDragPayload): string {
  return JSON.stringify(payload);
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

export function normalizePlaceEntityDropPayload(
  value: unknown,
): PlaceEntityDropPayload | undefined {
  if (
    !isRecord(value) ||
    value.type !== "entity" ||
    typeof value.entityId !== "string" ||
    !isFiniteNumber(value.screenX) ||
    !isFiniteNumber(value.screenY)
  ) {
    return undefined;
  }

  return {
    type: "entity",
    entityId: value.entityId,
    screenX: value.screenX,
    screenY: value.screenY,
  };
}

export function normalizePlaceTerrainDropPayload(
  value: unknown,
): PlaceTerrainDropPayload | undefined {
  if (
    !isRecord(value) ||
    value.type !== "terrain" ||
    typeof value.materialId !== "string" ||
    typeof value.brushId !== "string" ||
    !isFiniteNumber(value.screenX) ||
    !isFiniteNumber(value.screenY)
  ) {
    return undefined;
  }

  return {
    type: "terrain",
    materialId: value.materialId,
    brushId: value.brushId,
    screenX: value.screenX,
    screenY: value.screenY,
  };
}
