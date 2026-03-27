import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../../editors/office-layout/draft-state/useOfficeLayoutEditor", () => ({
  useOfficeLayoutEditor: vi.fn(),
}));

vi.mock("../useRuntimeUiBridge", () => ({
  useRuntimeUiBridge: vi.fn(),
}));

vi.mock("../useLayoutSaveState", () => ({
  useLayoutSaveState: vi.fn(),
}));

import { useOfficeLayoutEditor } from "../../../editors/office-layout/draft-state/useOfficeLayoutEditor";
import { useLayoutSaveState } from "../useLayoutSaveState";
import { useRuntimeUiBridge } from "../useRuntimeUiBridge";
import { useGameSession } from "../useGameSession";

describe("useGameSession", () => {
  test("composes office editor sync and runtime bridge projections through the public session hook", () => {
    const officeToolState = {
      activeTool: "floor" as const,
      activeFloorMode: "pick" as const,
      activeTileColor: "blue" as const,
      activeFloorColor: { h: 214, s: 30, b: -100, c: -55 },
      activeFloorPattern: "environment.floors.pattern-03",
      activeFurnitureId: "desk-01",
      onOfficeFloorPicked: vi.fn(),
    };
    const officeEditor = {
      syncFromRuntime: vi.fn(),
      isOpen: false,
      toggleOpen: vi.fn(),
    };
    const layoutSaveState = {
      canSave: true,
      canReset: true,
      error: null,
      isAvailable: true,
      isDirty: false,
      isSaving: false,
      reset: vi.fn(),
      save: vi.fn(),
      statusText: "Synced",
    };
    const runtimeBridge = {
      runtimeRootRef: { current: null },
      runtimeRootBindings: {
        onDragOver: vi.fn(),
        onDrop: vi.fn(),
      },
      sidebarViewModel: {
        placeablesPanel: {
          placeables: [],
          activeTerrainToolId: null,
          onDragStart: vi.fn(),
          onSelectTerrainTool: vi.fn(),
        },
        previewPanel: {
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
          inspectedTile: null,
          onClearInspectedTile: vi.fn(),
        },
        runtimeDiagnostics: null,
      },
      zoomViewModel: {
        zoom: 1,
        minZoom: 0.5,
        maxZoom: 2,
        onZoomIn: vi.fn(),
        onZoomOut: vi.fn(),
      },
      terrainSeedSnapshot: {
        width: 2,
        height: 2,
        chunkSize: 8,
        defaultMaterial: "soil",
        materials: ["soil"],
        legend: { ".": "soil" },
        rows: ["..", ".."],
      },
    };

    vi.mocked(useOfficeLayoutEditor).mockReturnValue(officeEditor as never);
    vi.mocked(useRuntimeUiBridge).mockReturnValue(runtimeBridge as never);
    vi.mocked(useLayoutSaveState).mockReturnValue(layoutSaveState as never);

    let result: ReturnType<typeof useGameSession> | null = null;

    function TestComponent(): null {
      result = useGameSession({ officeToolState });
      return null;
    }

    renderToStaticMarkup(createElement(TestComponent));

    expect(useRuntimeUiBridge).toHaveBeenCalledWith({
      officeToolState: {
        activeTool: officeToolState.activeTool,
        activeFloorMode: officeToolState.activeFloorMode,
        activeTileColor: officeToolState.activeTileColor,
        activeFloorColor: officeToolState.activeFloorColor,
        activeFloorPattern: officeToolState.activeFloorPattern,
        activeFurnitureId: officeToolState.activeFurnitureId,
      },
      onOfficeLayoutChanged: officeEditor.syncFromRuntime,
      onOfficeFloorPicked: officeToolState.onOfficeFloorPicked,
    });
    expect(useLayoutSaveState).toHaveBeenCalledWith({
      officeEditor,
      terrainSeedSnapshot: runtimeBridge.terrainSeedSnapshot,
    });
    expect(result).toEqual({
      layoutSaveState,
      officeEditor,
      ...runtimeBridge,
    });
  });
});
