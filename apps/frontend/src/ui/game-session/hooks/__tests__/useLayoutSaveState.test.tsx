// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TerrainSeedDocument } from "../../../../game";
import { useLayoutSaveState } from "../useLayoutSaveState";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("../../../../game", async () => {
  const actual = await vi.importActual<typeof import("../../../../game")>(
    "../../../../game",
  );

  return {
    ...actual,
    createTerrainSeedEditorService: vi.fn(),
  };
});

import { createTerrainSeedEditorService } from "../../../../game";

type OfficeEditorMock = {
  isAvailable: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  canReset: boolean;
  error: string | null;
  parseError: string | null;
  save: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

type TerrainServiceMock = {
  isAvailable: boolean;
  unavailableReason: string | null;
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

type HarnessProps = {
  officeEditor: OfficeEditorMock;
  terrainSeedSnapshot: TerrainSeedDocument | null;
  onRender: (state: ReturnType<typeof useLayoutSaveState>) => void;
};

function createTerrainDocument(rows: string[]): TerrainSeedDocument {
  return {
    width: 2,
    height: 2,
    chunkSize: 8,
    defaultMaterial: "soil",
    materials: ["soil", "rock"],
    legend: {
      ".": "soil",
      "#": "rock",
    },
    rows,
  };
}

function createOfficeEditor(overrides: Partial<OfficeEditorMock> = {}): OfficeEditorMock {
  return {
    isAvailable: true,
    isLoading: false,
    isSaving: false,
    isDirty: false,
    canReset: false,
    error: null,
    parseError: null,
    save: vi.fn(async () => {}),
    reset: vi.fn(),
    ...overrides,
  };
}

function createTerrainService(loadDocument: TerrainSeedDocument): TerrainServiceMock {
  return {
    isAvailable: true,
    unavailableReason: null,
    load: vi.fn(async () => ({
      document: loadDocument,
      sourcePath: "/workspace/terrain.json",
      updatedAt: "2026-03-24T08:00:00.000Z",
    })),
    save: vi.fn(async (document: TerrainSeedDocument) => ({
      document,
      sourcePath: "/workspace/terrain.json",
      updatedAt: "2026-03-24T09:00:00.000Z",
    })),
  };
}

function Harness({ officeEditor, terrainSeedSnapshot, onRender }: HarnessProps): null {
  onRender(useLayoutSaveState({ officeEditor, terrainSeedSnapshot }));
  return null;
}

async function renderHarness(options: {
  officeEditor: OfficeEditorMock;
  terrainSeedSnapshot: TerrainSeedDocument | null;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestState: ReturnType<typeof useLayoutSaveState> | null = null;

  await act(async () => {
    root.render(
      <Harness
        officeEditor={options.officeEditor}
        terrainSeedSnapshot={options.terrainSeedSnapshot}
        onRender={(state) => {
          latestState = state;
        }}
      />,
    );
  });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  return {
    flush,
    getState() {
      if (!latestState) {
        throw new Error("The layout save hook did not render.");
      }
      return latestState;
    },
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

describe("useLayoutSaveState", () => {
  test("enables the combined save when only terrain changed and persists both documents", async () => {
    const terrainBaseline = createTerrainDocument(["..", ".."]);
    const terrainCurrent = createTerrainDocument(["##", ".."]);
    const terrainService = createTerrainService(terrainBaseline);
    vi.mocked(createTerrainSeedEditorService).mockReturnValue(
      terrainService as never,
    );
    const officeEditor = createOfficeEditor();

    const harness = await renderHarness({
      officeEditor,
      terrainSeedSnapshot: terrainCurrent,
    });

    await harness.flush();

    expect(terrainService.load).toHaveBeenCalledTimes(1);
    expect(harness.getState()).toMatchObject({
      canSave: true,
      isDirty: true,
      isSaving: false,
      statusText: "Unsaved",
    });

    await act(async () => {
      await harness.getState().save();
    });

    expect(officeEditor.save).toHaveBeenCalledTimes(1);
    expect(terrainService.save).toHaveBeenCalledWith(terrainCurrent);
    expect(harness.getState()).toMatchObject({
      canSave: false,
      isDirty: false,
      isSaving: false,
      error: null,
      statusText: "Synced",
    });

    await harness.unmount();
  });

  test("blocks the combined save when the office JSON is invalid", async () => {
    const terrainBaseline = createTerrainDocument(["..", ".."]);
    const terrainCurrent = createTerrainDocument(["##", ".."]);
    const terrainService = createTerrainService(terrainBaseline);
    vi.mocked(createTerrainSeedEditorService).mockReturnValue(
      terrainService as never,
    );
    const officeEditor = createOfficeEditor({
      parseError: "The office layout JSON is invalid.",
      canReset: true,
      isDirty: true,
    });

    const harness = await renderHarness({
      officeEditor,
      terrainSeedSnapshot: terrainCurrent,
    });

    await harness.flush();

    expect(harness.getState()).toMatchObject({
      canSave: false,
      isDirty: true,
      statusText: "JSON Error",
    });

    await act(async () => {
      await harness.getState().save();
    });

    expect(officeEditor.save).not.toHaveBeenCalled();
    expect(terrainService.save).not.toHaveBeenCalled();

    await harness.unmount();
  });
});
