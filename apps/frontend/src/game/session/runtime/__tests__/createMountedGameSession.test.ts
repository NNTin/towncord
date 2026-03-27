import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../../runtime/transport/runtimeEvents";
import { UI_TO_RUNTIME_COMMANDS } from "../../../runtime/transport/uiCommands";
import type { RuntimeBootstrap } from "../../GameSession";
import { createMountedGameSession } from "../createMountedGameSession";

function createRuntimeHost() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    destroy: vi.fn(),
    events: {
      emit: vi.fn((event: string, payload?: unknown) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      }),
      on: vi.fn((event: string, listener: (payload: unknown) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }

        listeners.get(event)?.add(listener);
      }),
      off: vi.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.get(event)?.delete(listener);
      }),
    },
  };
}

function createBootstrapPayload(): RuntimeBootstrap {
  return {
    catalog: {
      entityTypes: [],
      playerModels: [],
      mobFamilies: [],
      propFamilies: [],
      tilesetFamilies: [],
      officeCharacterPalettes: [],
      officeCharacterIds: [],
      officeEnvironmentGroups: [],
      officeFurnitureGroups: [],
      tracksByPath: new Map(),
    },
    placeables: [
      {
        id: "terrain:grass:paint",
        type: "terrain",
        materialId: "grass",
        brushId: "paint",
        label: "Grass",
        groupKey: "terrain:ground",
        groupLabel: "Ground",
      },
    ],
  };
}

describe("createMountedGameSession", () => {
  test("owns runtime lifecycle and tears the runtime down idempotently", () => {
    const runtimeHost = createRuntimeHost();
    const session = createMountedGameSession(runtimeHost as never);

    session.destroy();
    session.destroy();
    session.selectTerrainTool({
      materialId: "grass",
      brushId: "paint",
    });

    expect(runtimeHost.destroy).toHaveBeenCalledTimes(1);
    expect(runtimeHost.destroy).toHaveBeenCalledWith(true);
    expect(runtimeHost.events.emit).not.toHaveBeenCalled();
  });

  test("replays bootstrap to late subscribers and ignores duplicate ready events", () => {
    const runtimeHost = createRuntimeHost();
    const session = createMountedGameSession(runtimeHost as never);
    const bootstrap = createBootstrapPayload();
    const terrainSeed = {
      seed: {
        width: 2,
        height: 1,
        chunkSize: 32,
        defaultMaterial: "grass",
        materials: ["grass"],
        legend: {
          ".": "grass",
        },
        rows: [".."],
      },
    };
    const firstSubscriber = {
      onBootstrap: vi.fn(),
      onTerrainSeedChanged: vi.fn(),
    };

    session.subscribe(firstSubscriber);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.RUNTIME_READY, bootstrap);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED, terrainSeed);

    const lateSubscriber = {
      onBootstrap: vi.fn(),
      onTerrainSeedChanged: vi.fn(),
    };
    session.subscribe(lateSubscriber);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.RUNTIME_READY, bootstrap);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.TERRAIN_SEED_CHANGED, terrainSeed);

    expect(firstSubscriber.onBootstrap).toHaveBeenCalledTimes(1);
    expect(firstSubscriber.onBootstrap).toHaveBeenCalledWith(bootstrap);
    expect(lateSubscriber.onBootstrap).toHaveBeenCalledTimes(1);
    expect(lateSubscriber.onBootstrap).toHaveBeenCalledWith(bootstrap);
    expect(firstSubscriber.onTerrainSeedChanged).toHaveBeenCalledTimes(2);
    expect(firstSubscriber.onTerrainSeedChanged).toHaveBeenCalledWith(terrainSeed.seed);
    expect(lateSubscriber.onTerrainSeedChanged).toHaveBeenCalledTimes(2);
    expect(lateSubscriber.onTerrainSeedChanged).toHaveBeenCalledWith(terrainSeed.seed);
  });

  test("supports unsubscribe and dispatches runtime commands through transport", () => {
    const runtimeHost = createRuntimeHost();
    const session = createMountedGameSession(runtimeHost as never);
    const onTerrainTileInspected = vi.fn();
    const unsubscribe = session.subscribe({
      onTerrainTileInspected,
    });

    unsubscribe();
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED, {
      textureKey: "debug.tilesets",
      frame: "grass_0",
      cellX: 4,
      cellY: 6,
      materialId: "grass",
      caseId: 2,
      rotate90: 0,
      flipX: false,
      flipY: false,
    });

    session.selectTerrainTool({
      materialId: "grass",
      brushId: "paint",
    });
    session.setOfficeEditorTool({ tool: null });
    session.setZoom(1.5);
    session.placeDragDrop(
      {
        type: "terrain",
        materialId: "stone",
        brushId: "fill",
      },
      {
        screenX: 12,
        screenY: 24,
      },
    );

    expect(onTerrainTileInspected).not.toHaveBeenCalled();
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      2,
      UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
      {
        materialId: "grass",
        brushId: "paint",
      },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      3,
      UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL,
      { tool: null },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      4,
      UI_TO_RUNTIME_COMMANDS.SET_ZOOM,
      { zoom: 1.5 },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      5,
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
});
