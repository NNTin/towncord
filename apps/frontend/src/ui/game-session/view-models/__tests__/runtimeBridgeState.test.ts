import { describe, expect, test } from "vitest";
import {
  createRuntimeBridgeState,
  reduceRuntimeBridgeState,
} from "../../../../game/application/transactions/runtimeBridgeState";
import { selectRuntimeSidebarProjection } from "../../../../game/application/projections/runtimeSidebarProjection";

function createBootstrapPayload() {
  return {
    catalog: {
      entityTypes: [],
      playerModels: [],
      mobFamilies: [],
      npcFamilies: [],
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
        type: "terrain" as const,
        materialId: "grass",
        brushId: "paint",
        label: "Grass",
        groupKey: "terrain:ground",
        groupLabel: "Ground",
      },
    ],
  };
}

describe("runtime sidebar projection owners", () => {
  test("projects sidebar data only after bootstrap is available", () => {
    expect(
      selectRuntimeSidebarProjection(createRuntimeBridgeState()),
    ).toBeNull();

    const state = reduceRuntimeBridgeState(createRuntimeBridgeState(), {
      type: "runtimeBootstrapped",
      payload: createBootstrapPayload(),
    });

    expect(selectRuntimeSidebarProjection(state)).toEqual({
      catalog: createBootstrapPayload().catalog,
      placeables: createBootstrapPayload().placeables,
      inspectedTile: null,
      runtimeDiagnostics: null,
    });
  });

  test("clears inspected tiles when a terrain tool becomes active", () => {
    const bootstrappedState = reduceRuntimeBridgeState(
      createRuntimeBridgeState(),
      {
        type: "runtimeBootstrapped",
        payload: createBootstrapPayload(),
      },
    );
    const inspectedState = reduceRuntimeBridgeState(bootstrappedState, {
      type: "terrainTileInspected",
      payload: {
        textureKey: "debug.tilesets",
        frame: "grass_0",
        cellX: 4,
        cellY: 9,
        materialId: "grass",
        caseId: 7,
        rotate90: 0,
        flipX: false,
        flipY: false,
      },
    });
    const nextState = reduceRuntimeBridgeState(inspectedState, {
      type: "terrainToolSelected",
      tool: {
        materialId: "grass",
        brushId: "paint",
      },
    });

    expect(selectRuntimeSidebarProjection(nextState)).toEqual({
      catalog: createBootstrapPayload().catalog,
      placeables: createBootstrapPayload().placeables,
      inspectedTile: null,
      runtimeDiagnostics: null,
    });
    expect(nextState.activeTerrainTool).toEqual({
      materialId: "grass",
      brushId: "paint",
    });
  });

  test("retains runtime diagnostics in the projected sidebar model", () => {
    const bootstrappedState = reduceRuntimeBridgeState(
      createRuntimeBridgeState(),
      {
        type: "runtimeBootstrapped",
        payload: createBootstrapPayload(),
      },
    );
    const state = reduceRuntimeBridgeState(bootstrappedState, {
      type: "runtimeDiagnosticsUpdated",
      payload: {
        timestampMs: 1000,
        fps: 58,
        frameMs: 16.9,
        updateMs: 5.2,
        terrainMs: 1.7,
      },
    });

    expect(selectRuntimeSidebarProjection(state)?.runtimeDiagnostics).toEqual({
      timestampMs: 1000,
      fps: 58,
      frameMs: 16.9,
      updateMs: 5.2,
      terrainMs: 1.7,
    });
  });

  test("switches from terrain paint to terrain prop placement when the prop tool is selected", () => {
    const state = reduceRuntimeBridgeState(createRuntimeBridgeState(), {
      type: "terrainToolSelected",
      tool: {
        materialId: "water",
        brushId: "paint",
      },
    });
    const nextState = reduceRuntimeBridgeState(state, {
      type: "terrainPropToolSelected",
      tool: {
        propId: "prop.static.set-01.variant-01",
        rotationQuarterTurns: 1,
      },
    });

    expect(nextState.activeTerrainTool).toBeNull();
    expect(nextState.activeTerrainPropTool).toEqual({
      propId: "prop.static.set-01.variant-01",
      rotationQuarterTurns: 1,
    });
  });

  test("preserves the active terrain source when source-agnostic terrain tools are selected", () => {
    const withFarmrpgTool = reduceRuntimeBridgeState(
      createRuntimeBridgeState(),
      {
        type: "terrainToolSelected",
        tool: {
          materialId: "water",
          brushId: "paint",
          terrainSourceId: "public-assets:terrain/farmrpg-grass",
        },
      },
    );
    const nextState = reduceRuntimeBridgeState(withFarmrpgTool, {
      type: "terrainToolSelected",
      tool: {
        materialId: "ground",
        brushId: "paint",
      },
    });

    expect(nextState.activeTerrainTool).toEqual({
      materialId: "ground",
      brushId: "paint",
      terrainSourceId: "public-assets:terrain/farmrpg-grass",
    });
  });
});
