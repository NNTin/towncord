// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../runtimeUiBridgeHooks", () => ({
  useRuntimeGatewayLifecycle: vi.fn(),
  useRuntimeInteractionAdapter: vi.fn(),
  useRuntimeSyncAdapter: vi.fn(),
}));

import {
  useRuntimeGatewayLifecycle,
  useRuntimeInteractionAdapter,
  useRuntimeSyncAdapter,
} from "../runtimeUiBridgeHooks";
import { useRuntimeUiBridge } from "../useRuntimeUiBridge";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue: ReturnType<typeof useRuntimeUiBridge> | null = null;

  function Harness(): null {
    latestValue = useRuntimeUiBridge({
      officeToolState: {
        activeTool: "floor",
        activeFloorMode: "paint",
        activeTileColor: null,
        activeFloorColor: { h: 0, s: 0, b: 0, c: 0 },
        activeFloorPattern: null,
        activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
        activeFurnitureId: null,
        activeFurnitureRotationQuarterTurns: 0,
      },
      onClearOfficeTool: clearOfficeTool,
    });
    return null;
  }

  const clearOfficeTool = vi.fn();
  const selectTerrainTool = vi.fn();
  const sessionRef = {
    current: {
      selectTerrainTool: vi.fn(),
      setOfficeEditorTool: vi.fn(),
      rotateSelectedOfficePlaceable: vi.fn(),
      deleteSelectedOfficePlaceable: vi.fn(),
    },
  };

  vi.mocked(useRuntimeSyncAdapter).mockReturnValue({
    activeTerrainTool: null,
    onBootstrap: vi.fn(),
    onClearInspectedTile: vi.fn(),
    onRuntimeDiagnostics: vi.fn(),
    onSelectTerrainTool: selectTerrainTool,
    onTerrainTileInspected: vi.fn(),
    onZoomChanged: vi.fn(),
    runtimeSidebarProjection: {
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
          id: "entity:player",
          type: "entity" as const,
          entityId: "player",
          label: "Player Spawn",
          groupKey: "entity:player",
          groupLabel: "Player",
          previewFrameKey: null,
        },
        {
          id: "terrain.water.tile",
          type: "terrain" as const,
          materialId: "water",
          brushId: "water",
          label: "Water Tile Brush",
          groupKey: "terrain",
          groupLabel: "Terrain",
        },
      ],
      inspectedTile: null,
      runtimeDiagnostics: null,
    },
    officeSelection: {
      selection: {
        kind: "furniture" as const,
        id: "desk-laptop",
        assetId: "ASSET_107",
        label: "Laptop - Front - Off",
        category: "electronics" as const,
        placement: "surface" as const,
        canRotate: true,
      },
    },
    zoomState: null,
    onOfficeSelectionChanged: vi.fn(),
  });

  vi.mocked(useRuntimeGatewayLifecycle).mockReturnValue({
    runtimeRootRef: { current: null },
    sessionRef,
  } as never);

  vi.mocked(useRuntimeInteractionAdapter).mockReturnValue({
    runtimeRootBindings: {
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
      onContextMenu: vi.fn(),
    },
    zoomViewModel: null,
  } as never);

  act(() => {
    root.render(<Harness />);
  });

  return {
    getValue() {
      if (!latestValue) {
        throw new Error("The runtime bridge did not render.");
      }

      return latestValue;
    },
    clearOfficeTool,
    selectTerrainTool,
    sessionRef,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("useRuntimeUiBridge", () => {
  test("clears the office tool when terrain is selected through either bridge entry point", async () => {
    const harness = renderHarness();
    const bridge = harness.getValue();

    expect(useRuntimeGatewayLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        onOfficeSelectionChanged: expect.any(Function),
      }),
    );

    await act(async () => {
      bridge.onSelectTerrainTool({
        materialId: "ground",
        brushId: "ground",
      });
    });

    expect(harness.clearOfficeTool).toHaveBeenCalledOnce();
    expect(harness.selectTerrainTool).toHaveBeenCalledWith({
      materialId: "ground",
      brushId: "ground",
    });

    harness.clearOfficeTool.mockClear();
    harness.selectTerrainTool.mockClear();

    await act(async () => {
      bridge.sidebarViewModel?.placeablesPanel.onSelectTerrainTool({
        id: "terrain.water.tile",
        type: "terrain",
        materialId: "water",
        brushId: "water",
        label: "Water Tile Brush",
        groupKey: "terrain",
        groupLabel: "Terrain",
      });
    });

    expect(harness.clearOfficeTool).toHaveBeenCalledOnce();
    expect(harness.selectTerrainTool).toHaveBeenCalledWith({
      materialId: "water",
      brushId: "water",
    });

    await harness.unmount();
  });

  test("projects entity placeables for the toolbar without terrain entries", async () => {
    const harness = renderHarness();
    const bridge = harness.getValue();

    expect(bridge.entityToolbarViewModel).toEqual({
      groups: [
        {
          key: "entity:player",
          label: "Player",
          placeables: [
            {
              id: "entity:player",
              type: "entity",
              entityId: "player",
              label: "Player Spawn",
              groupKey: "entity:player",
              groupLabel: "Player",
              previewFrameKey: null,
            },
          ],
        },
      ],
      onDragStart: expect.any(Function),
    });

    await harness.unmount();
  });

  test("exposes the selected office placeable and runtime actions", async () => {
    const harness = renderHarness();
    const bridge = harness.getValue();

    expect(bridge.selectedOfficePlaceable).toEqual({
      kind: "furniture",
      id: "desk-laptop",
      assetId: "ASSET_107",
      label: "Laptop - Front - Off",
      category: "electronics",
      placement: "surface",
      canRotate: true,
    });

    await act(async () => {
      bridge.onRotateSelectedOfficePlaceable();
      bridge.onDeleteSelectedOfficePlaceable();
    });

    expect(harness.sessionRef.current.rotateSelectedOfficePlaceable).toHaveBeenCalledOnce();
    expect(harness.sessionRef.current.deleteSelectedOfficePlaceable).toHaveBeenCalledOnce();

    await harness.unmount();
  });
});
