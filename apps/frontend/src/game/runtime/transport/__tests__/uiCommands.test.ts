import { describe, expect, test, vi } from "vitest";

vi.mock("public-assets-json:donarg-office/atlas.json", () => ({
  default: {
    meta: { size: { w: 1, h: 1 } },
    frames: {},
  },
}));

vi.mock("public-assets-json:donarg-office/furniture-catalog.json", () => ({
  default: {
    assets: [],
  },
}));

vi.mock("public-assets-json:bloomseed/atlas.json", () => ({
  default: {
    meta: { size: { w: 1, h: 1 } },
    frames: {},
  },
}));

import {
  bindUiToRuntimeCommand,
  emitPlaceDropCommand,
  normalizeOfficeSetEditorToolPayload,
  normalizeOfficeSelectionActionPayload,
  normalizeSelectedTerrainPropToolPayload,
  normalizeTerrainPropSelectionActionPayload,
  normalizeUiToRuntimeCommandPayload,
  UI_TO_RUNTIME_COMMANDS,
} from "../uiCommands";

type Listener = (payload: unknown) => void;

function createHost() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    host: {
      events: {
        emit(event: string, payload: unknown) {
          for (const listener of listeners.get(event) ?? []) {
            listener(payload);
          }
        },
        on(event: string, fn: Listener) {
          const eventListeners = listeners.get(event) ?? new Set<Listener>();
          eventListeners.add(fn);
          listeners.set(event, eventListeners);
        },
        off(event: string, fn: Listener) {
          listeners.get(event)?.delete(fn);
        },
      },
    },
  };
}

describe("uiCommands transport", () => {
  test("rejects malformed entity drop commands at the command boundary", () => {
    expect(
      normalizeUiToRuntimeCommandPayload(
        UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP,
        {
          type: "terrain",
          entityId: "player.seed",
          screenX: 32,
          screenY: 48,
        },
      ),
    ).toBeUndefined();
    expect(
      normalizeUiToRuntimeCommandPayload(
        UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP,
        {
          entityId: "player.seed",
          screenX: 32,
          screenY: 48,
        },
      ),
    ).toBeUndefined();
  });

  test("validates and clones office editor tool payloads", () => {
    const floorColor = { h: 214, s: 30, b: -100, c: -55 };
    const wallColor = { h: 214, s: 25, b: -54, c: 17 };
    const payload = normalizeOfficeSetEditorToolPayload({
      tool: "floor",
      floorMode: "pick",
      tileColor: "blue",
      floorColor,
      floorPattern: "environment.floors.pattern-03",
    });

    expect(payload).toEqual({
      tool: "floor",
      floorMode: "pick",
      tileColor: "blue",
      floorColor,
      floorPattern: "environment.floors.pattern-03",
    });
    expect(payload).not.toBeUndefined();
    expect(payload?.tool).toBe("floor");
    expect(
      payload && payload.tool === "floor" ? payload.floorColor : null,
    ).not.toBe(floorColor);
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "furniture",
        furnitureId: "ASSET_107",
        rotationQuarterTurns: 3,
      }),
    ).toEqual({
      tool: "furniture",
      furnitureId: "ASSET_107",
      rotationQuarterTurns: 3,
    });
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "wall",
        wallColor,
      }),
    ).toEqual({
      tool: "wall",
      wallColor,
    });
    const wallPayload = normalizeOfficeSetEditorToolPayload({
      tool: "wall",
      wallColor,
    });
    expect(wallPayload?.tool).toBe("wall");
    expect(
      wallPayload && wallPayload.tool === "wall" ? wallPayload.wallColor : null,
    ).not.toBe(wallColor);
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "prop",
        propId: "prop.static.set-01.variant-01",
        rotationQuarterTurns: 2,
      }),
    ).toEqual({
      tool: "prop",
      propId: "prop.static.set-01.variant-01",
      rotationQuarterTurns: 2,
    });
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "floor",
        floorMode: "pick",
        tileColor: "teal",
        floorColor,
        floorPattern: "environment.floors.pattern-03",
      }),
    ).toBeUndefined();
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "furniture",
        furnitureId: "ASSET_107",
        rotationQuarterTurns: 5,
      }),
    ).toBeUndefined();
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "wall",
        wallColor: { h: "214", s: 25, b: -54, c: 17 },
      }),
    ).toBeUndefined();
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "prop",
        propId: 42,
        rotationQuarterTurns: 0,
      }),
    ).toBeUndefined();
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "prop",
        propId: "prop.static.set-01.variant-01",
        rotationQuarterTurns: 5,
      }),
    ).toBeUndefined();
  });

  test("normalizes office selection actions at the command boundary", () => {
    expect(normalizeOfficeSelectionActionPayload({ action: "rotate" })).toEqual(
      {
        action: "rotate",
      },
    );
    expect(normalizeOfficeSelectionActionPayload({ action: "delete" })).toEqual(
      {
        action: "delete",
      },
    );
    expect(
      normalizeOfficeSelectionActionPayload({ action: "flip" }),
    ).toBeUndefined();
  });

  test("preserves optional terrain source ids on terrain tool selections", () => {
    expect(
      normalizeUiToRuntimeCommandPayload(
        UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
        {
          materialId: "water",
          brushId: "water",
          terrainSourceId: "public-assets:terrain/farmrpg-grass",
        },
      ),
    ).toEqual({
      materialId: "water",
      brushId: "water",
      terrainSourceId: "public-assets:terrain/farmrpg-grass",
    });

    expect(
      normalizeUiToRuntimeCommandPayload(
        UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
        {
          materialId: "water",
          brushId: "water",
          terrainSourceId: "public-assets:terrain/farmrpg-grass-summer",
        },
      ),
    ).toEqual({
      materialId: "water",
      brushId: "water",
      terrainSourceId: "public-assets:terrain/farmrpg-grass-summer",
    });
  });

  test("bindUiToRuntimeCommand drops malformed entity payloads", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const unbind = bindUiToRuntimeCommand(
      host,
      UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP,
      handler,
    );

    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      type: "entity",
      entityId: "player.seed",
      screenX: 16,
      screenY: 24,
    });
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      entityId: 42,
      screenX: 16,
      screenY: 24,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "entity",
      entityId: "player.seed",
      screenX: 16,
      screenY: 24,
    });

    unbind();
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      type: "entity",
      entityId: "player.seed",
      screenX: 32,
      screenY: 40,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("bindUiToRuntimeCommand drops malformed office selection actions", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const unbind = bindUiToRuntimeCommand(
      host,
      UI_TO_RUNTIME_COMMANDS.OFFICE_SELECTION_ACTION,
      handler,
    );

    host.events.emit(UI_TO_RUNTIME_COMMANDS.OFFICE_SELECTION_ACTION, {
      action: "rotate",
    });
    host.events.emit(UI_TO_RUNTIME_COMMANDS.OFFICE_SELECTION_ACTION, {
      action: "flip",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ action: "rotate" });

    unbind();
  });

  test("emitPlaceDropCommand routes normalized payloads to the correct command", () => {
    const { host } = createHost();
    const emitSpy = vi.spyOn(host.events, "emit");

    emitPlaceDropCommand(host, {
      type: "terrain",
      materialId: "stone",
      brushId: "fill",
      screenX: 12,
      screenY: 24,
    });

    expect(emitSpy).toHaveBeenCalledWith(
      UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP,
      {
        type: "terrain",
        materialId: "stone",
        brushId: "fill",
        screenX: 12,
        screenY: 24,
      },
    );
  });

  test("normalizes terrain prop tool payloads at the command boundary", () => {
    expect(
      normalizeSelectedTerrainPropToolPayload({
        propId: "prop.static.set-01.variant-01",
        rotationQuarterTurns: 3,
      }),
    ).toEqual({
      propId: "prop.static.set-01.variant-01",
      rotationQuarterTurns: 3,
    });
    expect(
      normalizeSelectedTerrainPropToolPayload({
        propId: "prop.static.set-01.variant-01",
        rotationQuarterTurns: 4,
      }),
    ).toBeUndefined();
    expect(normalizeSelectedTerrainPropToolPayload(null)).toBeNull();
  });

  test("normalizes terrain prop selection actions at the command boundary", () => {
    expect(
      normalizeTerrainPropSelectionActionPayload({ action: "rotate" }),
    ).toEqual({
      action: "rotate",
    });
    expect(
      normalizeTerrainPropSelectionActionPayload({ action: "delete" }),
    ).toEqual({
      action: "delete",
    });
    expect(
      normalizeTerrainPropSelectionActionPayload({ action: "flip" }),
    ).toBeUndefined();
  });
});
