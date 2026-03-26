import {
  type AnimationCatalog,
  type AnimationTrack,
  type OfficeColorAdjust,
} from "../../contracts/content";
import type {
  OfficeFloorPickedPayload,
  OfficeLayoutChangedPayload,
} from "../../contracts/office-editor";
import type {
  PlayerPlacedPayload,
  PlayerStateChangedPayload,
  PlaceableViewModel,
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  TerrainTileInspectedPayload,
  ZoomChangedPayload,
} from "../../contracts/runtime";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneLayout,
  OfficeSceneTile,
} from "../../contracts/office-scene";
import { isRecord } from "../../utils/typeGuards";
import type { RuntimeEventHost } from "./host";

export type {
  OfficeFloorPickedPayload,
  OfficeLayoutChangedPayload,
} from "../../contracts/office-editor";

export type {
  PlayerPlacedPayload,
  PlayerStateChangedPayload,
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  TerrainTileInspectedPayload,
  ZoomChangedPayload,
} from "../../contracts/runtime";

export const RUNTIME_TO_UI_EVENTS = {
  RUNTIME_READY: "runtimeReady",
  TERRAIN_TILE_INSPECTED: "terrainTileInspected",
  PLAYER_PLACED: "playerPlaced",
  PLAYER_STATE_CHANGED: "playerStateChanged",
  RUNTIME_PERF: "runtimePerf",
  ZOOM_CHANGED: "zoomChanged",
  OFFICE_FLOOR_PICKED: "officeFloorPicked",
  OFFICE_LAYOUT_CHANGED: "officeLayoutChanged",
} as const;

export const RUNTIME_READY_EVENT = RUNTIME_TO_UI_EVENTS.RUNTIME_READY;
export const TERRAIN_TILE_INSPECTED_EVENT =
  RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED;
export const PLAYER_PLACED_EVENT = RUNTIME_TO_UI_EVENTS.PLAYER_PLACED;
export const PLAYER_STATE_CHANGED_EVENT =
  RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED;
export const RUNTIME_PERF_EVENT = RUNTIME_TO_UI_EVENTS.RUNTIME_PERF;
export const ZOOM_CHANGED_EVENT = RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED;
export const OFFICE_FLOOR_PICKED_EVENT =
  RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED;
export const OFFICE_LAYOUT_CHANGED_EVENT =
  RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED;

export type RuntimeToUiEventName =
  (typeof RUNTIME_TO_UI_EVENTS)[keyof typeof RUNTIME_TO_UI_EVENTS];

export type RuntimeToUiEventPayloadByName = {
  [RUNTIME_TO_UI_EVENTS.RUNTIME_READY]: RuntimeBootstrapPayload;
  [RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED]: TerrainTileInspectedPayload;
  [RUNTIME_TO_UI_EVENTS.PLAYER_PLACED]: PlayerPlacedPayload;
  [RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED]: PlayerStateChangedPayload;
  [RUNTIME_TO_UI_EVENTS.RUNTIME_PERF]: RuntimePerfPayload;
  [RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED]: ZoomChangedPayload;
  [RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED]: OfficeFloorPickedPayload;
  [RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED]: OfficeLayoutChangedPayload;
};

type PayloadNormalizer<T> = (value: unknown) => T | undefined;

const ANIMATION_ENTITY_TYPE_SET = new Set([
  "player",
  "mobs",
  "props",
  "tilesets",
]);
const SPRITE_DIRECTION_SET = new Set(["up", "down", "side", "right"]);
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
const OFFICE_SCENE_FURNITURE_PLACEMENT_SET = new Set([
  "floor",
  "surface",
  "wall",
]);
const PLAYER_STATE_SET = new Set(["idle", "walk", "run"]);
const ROTATE_90_SET = new Set([0, 1, 2, 3]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneOfficeLayoutColorAdjust(
  color: OfficeColorAdjust,
): OfficeColorAdjust {
  return {
    h: color.h,
    s: color.s,
    b: color.b,
    c: color.c,
    ...(typeof color.colorize === "boolean"
      ? { colorize: color.colorize }
      : {}),
  };
}

function isOfficeLayoutColorAdjust(value: unknown): value is OfficeColorAdjust {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.h) &&
    isFiniteNumber(value.s) &&
    isFiniteNumber(value.b) &&
    isFiniteNumber(value.c) &&
    (!("colorize" in value) || typeof value.colorize === "boolean")
  );
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value == null) {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function normalizeNullableOfficeColorAdjust(
  value: unknown,
): OfficeColorAdjust | null | undefined {
  if (value == null) {
    return null;
  }

  return isOfficeLayoutColorAdjust(value)
    ? cloneOfficeLayoutColorAdjust(value)
    : undefined;
}

function isRotate90(value: unknown): value is 0 | 1 | 2 | 3 {
  return Number.isInteger(value) && ROTATE_90_SET.has(value as 0 | 1 | 2 | 3);
}

function isOfficeSceneTile(value: unknown): value is OfficeSceneTile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    OFFICE_SCENE_TILE_KIND_SET.has(value.kind) &&
    isFiniteNumber(value.tileId) &&
    (!("tint" in value) || value.tint == null || isFiniteNumber(value.tint)) &&
    (!("colorAdjust" in value) ||
      value.colorAdjust == null ||
      isOfficeLayoutColorAdjust(value.colorAdjust)) &&
    (!("pattern" in value) ||
      value.pattern == null ||
      typeof value.pattern === "string")
  );
}

function isOfficeSceneFurniture(value: unknown): value is OfficeSceneFurniture {
  if (!isRecord(value)) {
    return false;
  }

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
    isFiniteNumber(value.accentColor) &&
    (!("renderAsset" in value) ||
      value.renderAsset == null ||
      isOfficeSceneFurnitureRenderAsset(value.renderAsset))
  );
}

function isOfficeSceneFurnitureRenderAsset(
  value: unknown,
): value is NonNullable<OfficeSceneFurniture["renderAsset"]> {
  return (
    isRecord(value) &&
    typeof value.atlasKey === "string" &&
    isRecord(value.atlasFrame) &&
    isFiniteNumber(value.atlasFrame.x) &&
    isFiniteNumber(value.atlasFrame.y) &&
    isFiniteNumber(value.atlasFrame.w) &&
    isFiniteNumber(value.atlasFrame.h)
  );
}

function isOfficeSceneCharacter(value: unknown): value is OfficeSceneCharacter {
  if (!isRecord(value)) {
    return false;
  }

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
  if (!isRecord(value)) {
    return false;
  }

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

function isAnimationTrack(value: unknown): value is AnimationTrack {
  if (!isRecord(value) || !isRecord(value.keyByDirection)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.entityType === "string" &&
    ANIMATION_ENTITY_TYPE_SET.has(value.entityType) &&
    typeof value.directional === "boolean" &&
    Object.entries(value.keyByDirection).every(
      ([direction, key]) =>
        SPRITE_DIRECTION_SET.has(direction) && typeof key === "string",
    ) &&
    (value.undirectedKey == null || typeof value.undirectedKey === "string") &&
    Array.isArray(value.equipmentCompatible) &&
    value.equipmentCompatible.every(
      (equipmentId) => typeof equipmentId === "string",
    )
  );
}

function isAnimationCatalog(value: unknown): value is AnimationCatalog {
  if (!isRecord(value) || !(value.tracksByPath instanceof Map)) {
    return false;
  }

  const stringLists = [
    value.entityTypes,
    value.playerModels,
    value.mobFamilies,
    value.propFamilies,
    value.tilesetFamilies,
    value.officeCharacterPalettes,
    value.officeCharacterIds,
    value.officeEnvironmentGroups,
    value.officeFurnitureGroups,
  ];

  return (
    stringLists.every(
      (list) =>
        Array.isArray(list) && list.every((entry) => typeof entry === "string"),
    ) &&
    Array.from(value.tracksByPath.entries()).every(
      ([catalogPath, tracks]) =>
        typeof catalogPath === "string" &&
        Array.isArray(tracks) &&
        tracks.every(isAnimationTrack),
    )
  );
}

function isPlaceableViewModel(value: unknown): value is PlaceableViewModel {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.groupKey !== "string" ||
    typeof value.groupLabel !== "string"
  ) {
    return false;
  }

  if (value.type === "entity") {
    return typeof value.entityId === "string";
  }

  if (value.type === "terrain") {
    return (
      typeof value.materialId === "string" && typeof value.brushId === "string"
    );
  }

  return false;
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
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.worldX) ||
    !isFiniteNumber(value.worldY)
  ) {
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
  if (
    !isRecord(value) ||
    typeof value.state !== "string" ||
    !PLAYER_STATE_SET.has(value.state)
  ) {
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
    layout: structuredClone(value.layout),
  };
}

export function normalizeRuntimeBootstrapPayload(
  value: unknown,
): RuntimeBootstrapPayload | undefined {
  if (
    !isRecord(value) ||
    !isAnimationCatalog(value.catalog) ||
    !Array.isArray(value.placeables) ||
    !value.placeables.every(isPlaceableViewModel)
  ) {
    return undefined;
  }

  return structuredClone({
    catalog: value.catalog,
    placeables: value.placeables,
  });
}

const runtimeToUiEventNormalizers = {
  [RUNTIME_TO_UI_EVENTS.RUNTIME_READY]: normalizeRuntimeBootstrapPayload,
  [RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED]:
    normalizeTerrainTileInspectedPayload,
  [RUNTIME_TO_UI_EVENTS.PLAYER_PLACED]: normalizePlayerPlacedPayload,
  [RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED]:
    normalizePlayerStateChangedPayload,
  [RUNTIME_TO_UI_EVENTS.RUNTIME_PERF]: normalizeRuntimePerfPayload,
  [RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED]: normalizeZoomChangedPayload,
  [RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED]: normalizeOfficeFloorPickedPayload,
  [RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED]:
    normalizeOfficeLayoutChangedPayload,
} satisfies {
  [K in RuntimeToUiEventName]: PayloadNormalizer<
    RuntimeToUiEventPayloadByName[K]
  >;
};

export function normalizeRuntimeToUiEventPayload<
  K extends RuntimeToUiEventName,
>(event: K, payload: unknown): RuntimeToUiEventPayloadByName[K] | undefined {
  const normalizer = runtimeToUiEventNormalizers[event] as PayloadNormalizer<
    RuntimeToUiEventPayloadByName[K]
  >;
  return normalizer(payload);
}

export function emitRuntimeToUiEvent<K extends RuntimeToUiEventName>(
  host: RuntimeEventHost | null | undefined,
  event: K,
  payload: RuntimeToUiEventPayloadByName[K],
): void {
  const normalizedPayload = normalizeRuntimeToUiEventPayload(event, payload);
  if (!host || normalizedPayload === undefined) {
    return;
  }

  host.events.emit(event, normalizedPayload);
}

export function bindRuntimeToUiEvent<K extends RuntimeToUiEventName>(
  host: RuntimeEventHost,
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
