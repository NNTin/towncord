import {
  OFFICE_TILE_COLORS,
  type OfficeColorAdjust,
  type OfficeTileColor,
} from "../../contracts/content";
import type {
  OfficeFloorMode,
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";
import type {
  PlaceEntityDropPayload,
  PlaceTerrainDropPayload,
  SelectedTerrainToolPayload,
} from "../../contracts/runtime";
import type { TerrainBrushId, TerrainMaterialId } from "../../terrain/contracts";
import { isRecord } from "../../utils/typeGuards";
import type { RuntimeEventHost } from "./host";
import {
  normalizePlaceEntityDropPayload,
  normalizePlaceTerrainDropPayload,
} from "./placeDragPayload";

export type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";

export type {
  SelectedTerrainToolPayload,
} from "../../contracts/runtime";

export const UI_TO_RUNTIME_COMMANDS = {
  PLACE_ENTITY_DROP: "placeEntityDrop",
  PLACE_TERRAIN_DROP: "placeTerrainDrop",
  SELECT_TERRAIN_TOOL: "selectTerrainTool",
  SET_ZOOM: "setZoom",
  OFFICE_SET_EDITOR_TOOL: "officeSetEditorTool",
} as const;

export const PLACE_ENTITY_DROP_EVENT = UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP;
export const PLACE_TERRAIN_DROP_EVENT = UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP;
export const SELECT_TERRAIN_TOOL_EVENT = UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL;
export const SET_ZOOM_EVENT = UI_TO_RUNTIME_COMMANDS.SET_ZOOM;
export const OFFICE_SET_EDITOR_TOOL_EVENT = UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL;

export type SetZoomPayload = {
  zoom: number;
};

export type UiToRuntimeCommandName =
  (typeof UI_TO_RUNTIME_COMMANDS)[keyof typeof UI_TO_RUNTIME_COMMANDS];

export type UiToRuntimeCommandPayloadByName = {
  [UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP]: PlaceEntityDropPayload;
  [UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP]: PlaceTerrainDropPayload;
  [UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL]: SelectedTerrainToolPayload;
  [UI_TO_RUNTIME_COMMANDS.SET_ZOOM]: SetZoomPayload;
  [UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL]: OfficeSetEditorToolPayload;
};

type PayloadNormalizer<T> = (value: unknown) => T | undefined;

const OFFICE_TILE_COLOR_SET = new Set<string>(OFFICE_TILE_COLORS);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneOfficeLayoutColorAdjust(color: OfficeColorAdjust): OfficeColorAdjust {
  return {
    h: color.h,
    s: color.s,
    b: color.b,
    c: color.c,
    ...(typeof color.colorize === "boolean" ? { colorize: color.colorize } : {}),
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

const uiToRuntimeCommandNormalizers = {
  [UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP]: normalizePlaceEntityDropPayload,
  [UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP]: normalizePlaceTerrainDropPayload,
  [UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL]: normalizeSelectedTerrainToolPayload,
  [UI_TO_RUNTIME_COMMANDS.SET_ZOOM]: normalizeSetZoomPayload,
  [UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL]: normalizeOfficeSetEditorToolPayload,
} satisfies {
  [K in UiToRuntimeCommandName]: PayloadNormalizer<UiToRuntimeCommandPayloadByName[K]>;
};

export function normalizeUiToRuntimeCommandPayload<K extends UiToRuntimeCommandName>(
  command: K,
  payload: unknown,
): UiToRuntimeCommandPayloadByName[K] | undefined {
  const normalizer =
    uiToRuntimeCommandNormalizers[command] as PayloadNormalizer<UiToRuntimeCommandPayloadByName[K]>;
  return normalizer(payload);
}

export function emitUiToRuntimeCommand<K extends UiToRuntimeCommandName>(
  host: RuntimeEventHost | null | undefined,
  command: K,
  payload: UiToRuntimeCommandPayloadByName[K],
): void {
  const normalizedPayload = normalizeUiToRuntimeCommandPayload(command, payload);
  if (!host || normalizedPayload === undefined) {
    return;
  }

  host.events.emit(command, normalizedPayload);
}

export function emitPlaceDropCommand(
  host: RuntimeEventHost | null | undefined,
  payload: PlaceEntityDropPayload | PlaceTerrainDropPayload,
): void {
  if (payload.type === "entity") {
    emitUiToRuntimeCommand(host, UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, payload);
    return;
  }

  emitUiToRuntimeCommand(host, UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP, payload);
}

export function bindUiToRuntimeCommand<K extends UiToRuntimeCommandName>(
  host: RuntimeEventHost,
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
