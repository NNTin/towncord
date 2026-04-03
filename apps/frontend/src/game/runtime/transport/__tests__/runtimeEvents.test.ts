import { describe, expect, test, vi } from "vitest";
import {
  bindRuntimeToUiEvent,
  emitRuntimeToUiEvent,
  RUNTIME_TO_UI_EVENTS,
  type OfficeLayoutChangedPayload,
  type OfficeSelectionChangedPayload,
  type RuntimeBootstrapPayload,
  type TerrainPropSelectionChangedPayload,
  type TerrainSeedChangedPayload,
} from "../runtimeEvents";

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

function createLayoutSnapshot(): OfficeLayoutChangedPayload["layout"] {
  return {
    cols: 1,
    rows: 1,
    cellSize: 16,
    tiles: [
      {
        kind: "floor" as const,
        tileId: 0,
        tint: 0x475569,
        colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
        pattern: "environment.floors.pattern-01",
      },
    ],
    furniture: [
      {
        id: "desk-01",
        assetId: "desk-01",
        label: "Desk",
        category: "desks" as const,
        placement: "floor" as const,
        col: 0,
        row: 0,
        width: 1,
        height: 1,
        color: 0x111111,
        accentColor: 0x222222,
      },
    ],
    characters: [
      {
        id: "ari",
        label: "Ari",
        glyph: "A",
        col: 0,
        row: 0,
        color: 0x333333,
        accentColor: 0x444444,
      },
    ],
  };
}

function createBootstrapPayload(): RuntimeBootstrapPayload {
  return {
    catalog: {
      entityTypes: ["player", "npcs"],
      playerModels: ["female"],
      mobFamilies: [],
      npcFamilies: ["child"],
      propFamilies: [],
      tilesetFamilies: ["static"],
      officeCharacterPalettes: ["palette-0"],
      officeCharacterIds: ["office-worker"],
      officeEnvironmentGroups: ["floors"],
      officeFurnitureGroups: ["desks"],
      tracksByPath: new Map([
        [
          "player/female",
          [
            {
              id: "walk",
              label: "walk",
              entityType: "player" as const,
              directional: true,
              keyByDirection: {
                down: "characters.bloomseed.player.female.walk-down",
              },
              undirectedKey: null,
              equipmentCompatible: [],
            },
          ],
        ],
        [
          "npcs/child",
          [
            {
              id: "idle",
              label: "idle",
              entityType: "npcs" as const,
              directional: true,
              keyByDirection: {
                down: "characters.farmrpg.npc.child.idle.down",
              },
              undirectedKey: null,
              equipmentCompatible: [],
            },
          ],
        ],
      ]),
    },
    placeables: [
      {
        id: "entity:player.seed",
        type: "entity" as const,
        entityId: "player.seed",
        label: "Player",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: null,
      },
      {
        id: "terrain:grass",
        type: "terrain" as const,
        materialId: "grass",
        brushId: "fill",
        label: "Grass",
        groupKey: "terrain",
        groupLabel: "Terrain",
      },
    ],
  };
}

function createTerrainSeedPayload(): TerrainSeedChangedPayload {
  return {
    seed: {
      width: 2,
      height: 1,
      chunkSize: 32,
      defaultMaterial: "grass",
      materials: ["grass", "water"],
      legend: {
        ".": "grass",
        "~": "water",
      },
      rows: [".~"],
    },
  };
}

function createSelectionPayload(): OfficeSelectionChangedPayload {
  return {
    selection: {
      kind: "furniture",
      id: "desk-laptop",
      assetId: "ASSET_107",
      label: "Laptop - Front - Off",
      category: "electronics" as const,
      placement: "surface" as const,
      canRotate: true,
    },
  };
}

function createTerrainPropSelectionPayload(): TerrainPropSelectionChangedPayload {
  return {
    selection: {
      kind: "prop",
      propId: "prop.static.set-01.variant-01",
      label: "Variant 01",
      rotationQuarterTurns: 2,
      canRotate: true,
    },
  };
}

describe("runtimeEvents transport", () => {
  test("bindRuntimeToUiEvent normalizes zoom payloads before delivery", () => {
    const { host } = createHost();
    const handler = vi.fn();

    bindRuntimeToUiEvent(host, RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, handler);

    host.events.emit(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, {
      zoom: 24,
      minZoom: 16,
      maxZoom: 1,
    });

    expect(handler).toHaveBeenCalledWith({
      zoom: 16,
      minZoom: 1,
      maxZoom: 16,
    });
  });

  test("emits office layout changes as cloned snapshots", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const payload = { layout: createLayoutSnapshot() };

    bindRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      handler,
    );
    emitRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      payload,
    );

    const received = handler.mock.calls[0]?.[0];
    expect(received).toEqual(payload);
    expect(received?.layout).not.toBe(payload.layout);
    expect(received?.layout.tiles).not.toBe(payload.layout.tiles);

    payload.layout.tiles[0]!.kind = "wall";
    expect(received?.layout.tiles[0]?.kind).toBe("floor");
  });

  test("routes bootstrap notifications through the runtime transport boundary", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const payload = createBootstrapPayload();

    bindRuntimeToUiEvent(host, RUNTIME_TO_UI_EVENTS.RUNTIME_READY, handler);
    emitRuntimeToUiEvent(host, RUNTIME_TO_UI_EVENTS.RUNTIME_READY, payload);

    const received = handler.mock.calls[0]?.[0];
    expect(received).toEqual(payload);
    expect(received).not.toBe(payload);
    expect(received?.catalog).not.toBe(payload.catalog);
    expect(received?.catalog.tracksByPath).not.toBe(
      payload.catalog.tracksByPath,
    );
    expect(received?.placeables).not.toBe(payload.placeables);
  });

  test("emits terrain seed snapshots as cloned documents", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const payload = createTerrainSeedPayload();

    bindRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED,
      handler,
    );
    emitRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED,
      payload,
    );

    const received = handler.mock.calls[0]?.[0];
    expect(received).toEqual(payload);
    expect(received?.seed).not.toBe(payload.seed);

    payload.seed.rows[0] = "~~";
    expect(received?.seed.rows[0]).toBe(".~");
  });

  test("emits office selection snapshots as cloned payloads", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const payload = createSelectionPayload();

    bindRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.OFFICE_SELECTION_CHANGED,
      handler,
    );
    emitRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.OFFICE_SELECTION_CHANGED,
      payload,
    );

    const received = handler.mock.calls[0]?.[0];
    expect(received).toEqual(payload);
    expect(received).not.toBe(payload);
    expect(received?.selection).not.toBe(payload.selection);

    payload.selection!.label = "Changed label";
    expect(received?.selection?.label).toBe("Laptop - Front - Off");
  });

  test("emits terrain prop selection snapshots as cloned payloads", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const payload = createTerrainPropSelectionPayload();

    bindRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.TERRAIN_PROP_SELECTION_CHANGED,
      handler,
    );
    emitRuntimeToUiEvent(
      host,
      RUNTIME_TO_UI_EVENTS.TERRAIN_PROP_SELECTION_CHANGED,
      payload,
    );

    const received = handler.mock.calls[0]?.[0];
    expect(received).toEqual(payload);
    expect(received).not.toBe(payload);
    expect(received?.selection).not.toBe(payload.selection);

    payload.selection!.label = "Changed terrain prop";
    expect(received?.selection?.label).toBe("Variant 01");
  });
});
