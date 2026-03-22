import type { EntityId } from "./domain/model";
import {
  cloneOfficeColorAdjust,
  isOfficeColorAdjust,
  type OfficeColorAdjust,
} from "./office/colors";
import {
  OFFICE_TILE_COLORS,
  type OfficeTileColor,
} from "./office/model";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneLayout,
  OfficeSceneTile,
} from "./scenes/office/bootstrap";
import type { TerrainBrushId, TerrainMaterialId } from "./terrain/contracts";
import { isRecord } from "./utils/typeGuards";

export const PLACE_DRAG_MIME = "application/json";

export const UI_TO_RUNTIME_COMMANDS = {
  PLACE_OBJECT_DROP: "placeObjectDrop",
  PLACE_TERRAIN_DROP: "placeTerrainDrop",
  SELECT_TERRAIN_TOOL: "selectTerrainTool",
  SET_ZOOM: "setZoom",
  OFFICE_SET_EDITOR_TOOL: "officeSetEditorTool",
} as const;

export const RUNTIME_TO_UI_EVENTS = {
  TERRAIN_TILE_INSPECTED: "terrainTileInspected",
  PLAYER_PLACED: "playerPlaced",
  PLAYER_STATE_CHANGED: "playerStateChanged",
  RUNTIME_PERF: "runtimePerf",
  ZOOM_CHANGED: "zoomChanged",
  OFFICE_FLOOR_PICKED: "officeFloorPicked",
  OFFICE_LAYOUT_CHANGED: "officeLayoutChanged",
} as const;

export const PLACE_OBJECT_DROP_EVENT = UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP;
export const PLACE_TERRAIN_DROP_EVENT = UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP;
export const SELECT_TERRAIN_TOOL_EVENT = UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL;
export const SET_ZOOM_EVENT = UI_TO_RUNTIME_COMMANDS.SET_ZOOM;
export const OFFICE_SET_EDITOR_TOOL_EVENT = UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL;

export const TERRAIN_TILE_INSPECTED_EVENT = RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED;
export const PLAYER_PLACED_EVENT = RUNTIME_TO_UI_EVENTS.PLAYER_PLACED;
export const PLAYER_STATE_CHANGED_EVENT = RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED;
export const RUNTIME_PERF_EVENT = RUNTIME_TO_UI_EVENTS.RUNTIME_PERF;
export const ZOOM_CHANGED_EVENT = RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED;
export const OFFICE_FLOOR_PICKED_EVENT = RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED;
export const OFFICE_LAYOUT_CHANGED_EVENT = RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED;

export type OfficeEditorToolId = "floor" | "wall" | "erase" | "furniture";
export type OfficeFloorMode = "paint" | "pick";

export type OfficeLayoutChangedPayload = {
  layout: OfficeSceneLayout;
};

export type OfficeSetEditorToolNonePayload = {
  tool: null;
};

export type OfficeSetEditorToolWallPayload = {
  tool: "wall";
};

export type OfficeSetEditorToolErasePayload = {
  tool: "erase";
};

export type OfficeSetEditorToolFurniturePayload = {
  tool: "furniture";
  furnitureId: string | null;
};

export type OfficeSetEditorToolFloorPayload = {
  tool: "floor";
  floorMode: OfficeFloorMode;
  tileColor: OfficeTileColor | null;
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
};

export type OfficeSetEditorToolPayload =
  | OfficeSetEditorToolNonePayload
  | OfficeSetEditorToolWallPayload
  | OfficeSetEditorToolErasePayload
  | OfficeSetEditorToolFurniturePayload
  | OfficeSetEditorToolFloorPayload;

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

export type PlaceDropPayload = PlaceEntityDropPayload | PlaceTerrainDropPayload;

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

export type UiToRuntimeCommandName =
  (typeof UI_TO_RUNTIME_COMMANDS)[keyof typeof UI_TO_RUNTIME_COMMANDS];

export type RuntimeToUiEventName =
  (typeof RUNTIME_TO_UI_EVENTS)[keyof typeof RUNTIME_TO_UI_EVENTS];

export type UiToRuntimeCommandPayloadByName = {
  [UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP]: PlaceObjectDropPayload;
  [UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP]: PlaceTerrainDropPayload;
  [UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL]: SelectedTerrainToolPayload;
  [UI_TO_RUNTIME_COMMANDS.SET_ZOOM]: SetZoomPayload;
  [UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL]: OfficeSetEditorToolPayload;
};

export type RuntimeToUiEventPayloadByName = {
  [RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED]: TerrainTileInspectedPayload;
  [RUNTIME_TO_UI_EVENTS.PLAYER_PLACED]: PlayerPlacedPayload;
  [RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED]: PlayerStateChangedPayload;
  [RUNTIME_TO_UI_EVENTS.RUNTIME_PERF]: RuntimePerfPayload;
  [RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED]: ZoomChangedPayload;
  [RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED]: OfficeFloorPickedPayload;
  [RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED]: OfficeLayoutChangedPayload;
};

type ProtocolStability = "stable" | "compatibility" | "runtime-internal";

type ProtocolEntryMetadata = {
  stability: ProtocolStability;
  description: string;
};

export const BLOOMSEED_UI_RUNTIME_PROTOCOL = {
  commands: {
    [UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP]: {
      stability: "compatibility",
      description:
        "Legacy entity-placement command retained while callers migrate to explicit command helpers.",
    },
    [UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP]: {
      stability: "stable",
      description: "Stable terrain-paint placement command from React into the runtime.",
    },
    [UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL]: {
      stability: "stable",
      description: "Stable terrain-tool selection command from React into the runtime.",
    },
    [UI_TO_RUNTIME_COMMANDS.SET_ZOOM]: {
      stability: "stable",
      description: "Stable zoom-control command from React into the runtime camera controller.",
    },
    [UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL]: {
      stability: "stable",
      description: "Stable office-editor tool command from React into the world scene.",
    },
  } satisfies Record<UiToRuntimeCommandName, ProtocolEntryMetadata>,
  events: {
    [RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED]: {
      stability: "stable",
      description: "Stable terrain inspection event surfaced to React sidebar consumers.",
    },
    [RUNTIME_TO_UI_EVENTS.PLAYER_PLACED]: {
      stability: "runtime-internal",
      description: "Runtime-only placement notification used by gameplay modules, not the public UI bridge.",
    },
    [RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED]: {
      stability: "runtime-internal",
      description: "Runtime-only player movement notification used by gameplay modules, not the public UI bridge.",
    },
    [RUNTIME_TO_UI_EVENTS.RUNTIME_PERF]: {
      stability: "stable",
      description: "Stable runtime performance event consumed by React debug panels.",
    },
    [RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED]: {
      stability: "stable",
      description: "Stable zoom state event emitted from the camera back to React controls.",
    },
    [RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED]: {
      stability: "stable",
      description: "Stable office floor picker event emitted from the runtime to React tool state.",
    },
    [RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED]: {
      stability: "stable",
      description: "Stable office layout change event emitted from the runtime to React editors.",
    },
  } satisfies Record<RuntimeToUiEventName, ProtocolEntryMetadata>,
} as const;

type ProtocolHost = {
  events: {
    emit: (event: string, payload: unknown) => void;
    on: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
    off: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
  };
};

type PayloadNormalizer<T> = (value: unknown) => T | undefined;

const OFFICE_TILE_COLOR_SET = new Set<string>(OFFICE_TILE_COLORS);
const OFFICE_SCENE_TILE_KIND_SET = new Set(["void", "floor", "wall"]);
const OFFICE_SCENE_FURNITURE_CATEGORY_SET = new Set([
  "chairs",
  "decor",
  "desks",
  "electronics",
  "misc",
  "storage",
  "wall",
  "unknown",
]);
const OFFICE_SCENE_FURNITURE_PLACEMENT_SET = new Set(["floor", "surface", "wall"]);
const PLAYER_STATE_SET = new Set(["idle", "walk", "run"]);
const ROTATE_90_SET = new Set([0, 1, 2, 3]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function isRotate90(value: unknown): value is 0 | 1 | 2 | 3 {
  return Number.isInteger(value) && ROTATE_90_SET.has(value as 0 | 1 | 2 | 3);
}

function normalizeNullableOfficeColorAdjust(
  value: unknown,
): OfficeColorAdjust | null | undefined {
  if (value == null) {
    return null;
  }

  return isOfficeColorAdjust(value) ? cloneOfficeColorAdjust(value) : undefined;
}

function normalizeNullableOfficeTileColor(
  value: unknown,
): OfficeTileColor | null | undefined {
  if (value == null) {
    return null;
  }

  return typeof value === "string" && OFFICE_TILE_COLOR_SET.has(value)
    ? (value as OfficeTileColor)
    : undefined;
}

function isOfficeSceneTile(value: unknown): value is OfficeSceneTile {
  if (!isRecord(value)) return false;

  return (
    typeof value.kind === "string" &&
    OFFICE_SCENE_TILE_KIND_SET.has(value.kind) &&
    isFiniteNumber(value.tileId) &&
    (!("tint" in value) || value.tint == null || isFiniteNumber(value.tint)) &&
    (!("colorAdjust" in value) ||
      value.colorAdjust == null ||
      isOfficeColorAdjust(value.colorAdjust)) &&
    (!("pattern" in value) || value.pattern == null || typeof value.pattern === "string")
  );
}

function isOfficeSceneFurniture(value: unknown): value is OfficeSceneFurniture {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.assetId === "string" &&
    typeof value.label === "string" &&
    typeof value.category === "string" &&
    OFFICE_SCENE_FURNITURE_CATEGORY_SET.has(value.category) &&
    typeof value.placement === "string" &&
    OFFICE_SCENE_FURNITURE_PLACEMENT_SET.has(value.placement) &&
    isFiniteNumber(value.col) &&
    isFiniteNumber(value.row) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.color) &&
    isFiniteNumber(value.accentColor)
  );
}

function isOfficeSceneCharacter(value: unknown): value is OfficeSceneCharacter {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.glyph === "string" &&
    isFiniteNumber(value.col) &&
    isFiniteNumber(value.row) &&
    isFiniteNumber(value.color) &&
    isFiniteNumber(value.accentColor)
  );
}

function isOfficeSceneLayout(value: unknown): value is OfficeSceneLayout {
  if (!isRecord(value)) return false;

  return (
    isFiniteNumber(value.cols) &&
    isFiniteNumber(value.rows) &&
    isFiniteNumber(value.cellSize) &&
    Array.isArray(value.tiles) &&
    value.tiles.every(isOfficeSceneTile) &&
    Array.isArray(value.furniture) &&
    value.furniture.every(isOfficeSceneFurniture) &&
    Array.isArray(value.characters) &&
    value.characters.every(isOfficeSceneCharacter)
  );
}

function normalizePlaceDragPayloadInternal(value: unknown): PlaceDragPayload | undefined {
  if (!isRecord(value)) return undefined;

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

  return undefined;
}

export function parsePlaceDragPayload(value: unknown): PlaceDragPayload | null {
  return normalizePlaceDragPayloadInternal(value) ?? null;
}

export function parsePlaceDragMimePayload(rawPayload: string): PlaceDragPayload | null {
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

export function normalizePlaceObjectDropPayload(
  value: unknown,
): PlaceObjectDropPayload | undefined {
  if (!isRecord(value)) return undefined;
  if (!isFiniteNumber(value.screenX) || !isFiniteNumber(value.screenY)) {
    return undefined;
  }

  const dragPayload = normalizePlaceDragPayloadInternal(value);
  if (!dragPayload || dragPayload.type !== "entity") {
    return undefined;
  }

  return {
    type: "entity",
    entityId: dragPayload.entityId,
    screenX: value.screenX,
    screenY: value.screenY,
  };
}

export function normalizePlaceTerrainDropPayload(
  value: unknown,
): PlaceTerrainDropPayload | undefined {
  if (!isRecord(value)) return undefined;
  if (
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

export function normalizeSelectedTerrainToolPayload(
  value: unknown,
): SelectedTerrainToolPayload | undefined {
  if (value == null) {
    return null;
  }

  if (
    !isRecord(value) ||
    typeof value.materialId !== "string" ||
    typeof value.brushId !== "string"
  ) {
    return undefined;
  }

  return {
    materialId: value.materialId,
    brushId: value.brushId,
  };
}

export function normalizeSetZoomPayload(value: unknown): SetZoomPayload | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.zoom) || value.zoom <= 0) {
    return undefined;
  }

  return { zoom: value.zoom };
}

export function normalizeOfficeSetEditorToolPayload(
  value: unknown,
): OfficeSetEditorToolPayload | undefined {
  if (!isRecord(value) || !("tool" in value)) {
    return undefined;
  }

  switch (value.tool) {
    case null:
      return { tool: null };
    case "wall":
    case "erase":
      return { tool: value.tool };
    case "furniture": {
      const furnitureId = normalizeNullableString(value.furnitureId);
      if (furnitureId === undefined) {
        return undefined;
      }

      return {
        tool: "furniture",
        furnitureId,
      };
    }
    case "floor": {
      const tileColor = normalizeNullableOfficeTileColor(value.tileColor);
      const floorColor = normalizeNullableOfficeColorAdjust(value.floorColor);
      const floorPattern = normalizeNullableString(value.floorPattern);
      if (
        (value.floorMode !== "paint" && value.floorMode !== "pick") ||
        tileColor === undefined ||
        floorColor === undefined ||
        floorPattern === undefined
      ) {
        return undefined;
      }

      return {
        tool: "floor",
        floorMode: value.floorMode,
        tileColor,
        floorColor,
        floorPattern,
      };
    }
    default:
      return undefined;
  }
}

export function normalizeTerrainTileInspectedPayload(
  value: unknown,
): TerrainTileInspectedPayload | undefined {
  if (
    !isRecord(value) ||
    typeof value.textureKey !== "string" ||
    typeof value.frame !== "string" ||
    !isFiniteNumber(value.cellX) ||
    !isFiniteNumber(value.cellY) ||
    typeof value.materialId !== "string" ||
    !isFiniteNumber(value.caseId) ||
    !isRotate90(value.rotate90) ||
    typeof value.flipX !== "boolean" ||
    typeof value.flipY !== "boolean"
  ) {
    return undefined;
  }

  return {
    textureKey: value.textureKey,
    frame: value.frame,
    cellX: value.cellX,
    cellY: value.cellY,
    materialId: value.materialId,
    caseId: value.caseId,
    rotate90: value.rotate90,
    flipX: value.flipX,
    flipY: value.flipY,
  };
}

export function normalizePlayerPlacedPayload(
  value: unknown,
): PlayerPlacedPayload | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.worldX) || !isFiniteNumber(value.worldY)) {
    return undefined;
  }

  return {
    worldX: value.worldX,
    worldY: value.worldY,
  };
}

export function normalizePlayerStateChangedPayload(
  value: unknown,
): PlayerStateChangedPayload | undefined {
  if (!isRecord(value) || typeof value.state !== "string" || !PLAYER_STATE_SET.has(value.state)) {
    return undefined;
  }

  return {
    state: value.state as PlayerStateChangedPayload["state"],
  };
}

export function normalizeRuntimePerfPayload(
  value: unknown,
): RuntimePerfPayload | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.timestampMs) ||
    !isFiniteNumber(value.fps) ||
    !isFiniteNumber(value.frameMs) ||
    !isFiniteNumber(value.updateMs) ||
    !isFiniteNumber(value.terrainMs)
  ) {
    return undefined;
  }

  return {
    timestampMs: value.timestampMs,
    fps: value.fps,
    frameMs: value.frameMs,
    updateMs: value.updateMs,
    terrainMs: value.terrainMs,
  };
}

export function normalizeZoomChangedPayload(
  value: unknown,
): ZoomChangedPayload | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.zoom) ||
    !isFiniteNumber(value.minZoom) ||
    !isFiniteNumber(value.maxZoom)
  ) {
    return undefined;
  }

  const minZoom = Math.min(value.minZoom, value.maxZoom);
  const maxZoom = Math.max(value.minZoom, value.maxZoom);
  return {
    zoom: Math.min(maxZoom, Math.max(minZoom, value.zoom)),
    minZoom,
    maxZoom,
  };
}

export function normalizeOfficeFloorPickedPayload(
  value: unknown,
): OfficeFloorPickedPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const floorColor = normalizeNullableOfficeColorAdjust(value.floorColor);
  const floorPattern = normalizeNullableString(value.floorPattern);
  if (floorColor === undefined || floorPattern === undefined) {
    return undefined;
  }

  return {
    floorColor,
    floorPattern,
  };
}

export function normalizeOfficeLayoutChangedPayload(
  value: unknown,
): OfficeLayoutChangedPayload | undefined {
  if (!isRecord(value) || !isOfficeSceneLayout(value.layout)) {
    return undefined;
  }

  return {
    layout: value.layout,
  };
}

const uiToRuntimeCommandNormalizers = {
  [UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP]: normalizePlaceObjectDropPayload,
  [UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP]: normalizePlaceTerrainDropPayload,
  [UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL]: normalizeSelectedTerrainToolPayload,
  [UI_TO_RUNTIME_COMMANDS.SET_ZOOM]: normalizeSetZoomPayload,
  [UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL]: normalizeOfficeSetEditorToolPayload,
} satisfies {
  [K in UiToRuntimeCommandName]: PayloadNormalizer<UiToRuntimeCommandPayloadByName[K]>;
};

const runtimeToUiEventNormalizers = {
  [RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED]: normalizeTerrainTileInspectedPayload,
  [RUNTIME_TO_UI_EVENTS.PLAYER_PLACED]: normalizePlayerPlacedPayload,
  [RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED]: normalizePlayerStateChangedPayload,
  [RUNTIME_TO_UI_EVENTS.RUNTIME_PERF]: normalizeRuntimePerfPayload,
  [RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED]: normalizeZoomChangedPayload,
  [RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED]: normalizeOfficeFloorPickedPayload,
  [RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED]: normalizeOfficeLayoutChangedPayload,
} satisfies {
  [K in RuntimeToUiEventName]: PayloadNormalizer<RuntimeToUiEventPayloadByName[K]>;
};

export function normalizeUiToRuntimeCommandPayload<K extends UiToRuntimeCommandName>(
  command: K,
  payload: unknown,
): UiToRuntimeCommandPayloadByName[K] | undefined {
  const normalizer =
    uiToRuntimeCommandNormalizers[command] as PayloadNormalizer<UiToRuntimeCommandPayloadByName[K]>;
  return normalizer(payload);
}

export function normalizeRuntimeToUiEventPayload<K extends RuntimeToUiEventName>(
  event: K,
  payload: unknown,
): RuntimeToUiEventPayloadByName[K] | undefined {
  const normalizer =
    runtimeToUiEventNormalizers[event] as PayloadNormalizer<RuntimeToUiEventPayloadByName[K]>;
  return normalizer(payload);
}

export function emitUiToRuntimeCommand<K extends UiToRuntimeCommandName>(
  host: ProtocolHost | null | undefined,
  command: K,
  payload: UiToRuntimeCommandPayloadByName[K],
): void {
  const normalizedPayload = normalizeUiToRuntimeCommandPayload(command, payload);
  if (!host || normalizedPayload === undefined) {
    return;
  }

  host.events.emit(command, normalizedPayload);
}

export function emitRuntimeToUiEvent<K extends RuntimeToUiEventName>(
  host: ProtocolHost | null | undefined,
  event: K,
  payload: RuntimeToUiEventPayloadByName[K],
): void {
  const normalizedPayload = normalizeRuntimeToUiEventPayload(event, payload);
  if (!host || normalizedPayload === undefined) {
    return;
  }

  host.events.emit(event, normalizedPayload);
}

export function emitPlaceDropCommand(
  host: ProtocolHost | null | undefined,
  payload: PlaceObjectDropPayload | PlaceTerrainDropPayload,
): void {
  if (payload.type === "entity") {
    emitUiToRuntimeCommand(host, UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP, payload);
    return;
  }

  emitUiToRuntimeCommand(host, UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP, payload);
}

export function bindUiToRuntimeCommand<K extends UiToRuntimeCommandName>(
  host: ProtocolHost,
  command: K,
  handler: (payload: UiToRuntimeCommandPayloadByName[K]) => void,
  context?: unknown,
): () => void {
  const wrapped = (rawPayload: unknown): void => {
    const payload = normalizeUiToRuntimeCommandPayload(command, rawPayload);
    if (payload !== undefined) {
      handler(payload);
    }
  };

  host.events.on(command, wrapped, context);
  return () => {
    host.events.off(command, wrapped, context);
  };
}

export function bindRuntimeToUiEvent<K extends RuntimeToUiEventName>(
  host: ProtocolHost,
  event: K,
  handler: (payload: RuntimeToUiEventPayloadByName[K]) => void,
  context?: unknown,
): () => void {
  const wrapped = (rawPayload: unknown): void => {
    const payload = normalizeRuntimeToUiEventPayload(event, rawPayload);
    if (payload !== undefined) {
      handler(payload);
    }
  };

  host.events.on(event, wrapped, context);
  return () => {
    host.events.off(event, wrapped, context);
  };
}
