// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  OfficeLayoutDocument,
  OfficeLayoutPersistenceAdapter,
} from "../../../../../game";
import type { OfficeSceneLayout } from "../../../../../game/officeLayoutContract";
import {
  type OfficeLayoutEditorState,
  useOfficeLayoutEditor,
} from "../useOfficeLayoutEditor";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HarnessProps = {
  onRender: (state: OfficeLayoutEditorState) => void;
  persistence: OfficeLayoutPersistenceAdapter;
};

type RenderHarnessResult = {
  flush: () => Promise<void>;
  getState: () => OfficeLayoutEditorState;
  unmount: () => Promise<void>;
};

function formatOfficeLayout(document: OfficeLayoutDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function createSnapshot(
  document: OfficeLayoutDocument,
  updatedAt = "2026-03-24T08:00:00.000Z",
) {
  return {
    document,
    sourcePath: "/workspace/default-layout.json",
    updatedAt,
  };
}

function createPersistenceAdapter(options: {
  initialDocument?: OfficeLayoutDocument;
  saveDocument?: OfficeLayoutDocument;
} = {}) {
  const initialDocument =
    options.initialDocument ??
    ({
      version: 2,
      cols: 2,
      rows: 1,
      tiles: [0, 1],
      furniture: [],
      characters: [],
    } satisfies OfficeLayoutDocument);
  const saveDocument = options.saveDocument ?? initialDocument;
  const load = vi.fn(async () => createSnapshot(initialDocument));
  const save = vi.fn(async () => createSnapshot(saveDocument, "2026-03-24T09:00:00.000Z"));

  const adapter: OfficeLayoutPersistenceAdapter = {
    id: "test",
    isAvailable: true,
    unavailableReason: null,
    load,
    save,
  };

  return { adapter, load, save };
}

function Harness({ onRender, persistence }: HarnessProps): null {
  onRender(useOfficeLayoutEditor({ persistence }));
  return null;
}

async function renderHookHarness(
  persistence: OfficeLayoutPersistenceAdapter,
): Promise<RenderHarnessResult> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestState: OfficeLayoutEditorState | null = null;

  await act(async () => {
    root.render(<Harness persistence={persistence} onRender={(state) => {
      latestState = state;
    }} />);
  });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  return {
    flush,
    getState() {
      if (!latestState) {
        throw new Error("The office layout editor hook did not render.");
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
});

describe("useOfficeLayoutEditor", () => {
  test("reloads the persisted office layout on mount", async () => {
    const { adapter, load } = createPersistenceAdapter();
    const harness = await renderHookHarness(adapter);

    await harness.flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(harness.getState()).toMatchObject({
      isDirty: false,
      isLoading: false,
      isSaving: false,
      error: null,
      parseError: null,
      sourcePath: "/workspace/default-layout.json",
      updatedAt: "2026-03-24T08:00:00.000Z",
      statusText: "Synced",
      jsonText: formatOfficeLayout({
        version: 2,
        cols: 2,
        rows: 1,
        tiles: [0, 1],
        furniture: [],
        characters: [],
      }),
    });

    await harness.unmount();
  });

  test("keeps dirty, save, and reset behavior stable", async () => {
    const { adapter, save } = createPersistenceAdapter({
      saveDocument: {
        version: 2,
        cols: 3,
        rows: 1,
        tiles: [0, 1, 2],
        furniture: [],
        characters: [],
      },
    });
    const harness = await renderHookHarness(adapter);

    await harness.flush();

    await act(async () => {
      harness.getState().onChangeJsonText(
        formatOfficeLayout({
          version: 2,
          cols: 3,
          rows: 1,
          tiles: [0, 1, 2],
          furniture: [],
          characters: [],
        }),
      );
    });

    expect(harness.getState()).toMatchObject({
      isDirty: true,
      canSave: true,
      canReset: true,
      statusText: "Unsaved",
    });

    await act(async () => {
      await harness.getState().save();
    });

    expect(save).toHaveBeenCalledWith({
      version: 2,
      cols: 3,
      rows: 1,
      tiles: [0, 1, 2],
      furniture: [],
      characters: [],
    });
    expect(harness.getState()).toMatchObject({
      isDirty: false,
      canSave: false,
      canReset: false,
      updatedAt: "2026-03-24T09:00:00.000Z",
      statusText: "Synced",
    });

    await act(async () => {
      harness.getState().onChangeJsonText(
        formatOfficeLayout({
          version: 2,
          cols: 4,
          rows: 1,
          tiles: [0, 1, 2, 3],
          furniture: [],
          characters: [],
        }),
      );
    });
    expect(harness.getState().isDirty).toBe(true);

    await act(async () => {
      harness.getState().reset();
    });

    expect(harness.getState()).toMatchObject({
      isDirty: false,
      canSave: false,
      canReset: false,
    });
    expect(JSON.parse(harness.getState().jsonText)).toMatchObject({
      version: 2,
      cols: 3,
      rows: 1,
      tiles: [0, 1, 2],
    });

    await harness.unmount();
  });

  test("blocks save when the edited JSON is invalid", async () => {
    const { adapter, save } = createPersistenceAdapter();
    const harness = await renderHookHarness(adapter);

    await harness.flush();

    await act(async () => {
      harness.getState().onChangeJsonText("[]");
    });

    expect(harness.getState()).toMatchObject({
      parseError: "The office layout JSON is missing required top-level fields.",
      canSave: false,
      canReset: true,
      statusText: "JSON Error",
    });

    await act(async () => {
      await harness.getState().save();
    });

    expect(save).not.toHaveBeenCalled();

    await harness.unmount();
  });

  test("syncs the editor buffer from runtime layout changes", async () => {
    const { adapter } = createPersistenceAdapter();
    const harness = await renderHookHarness(adapter);

    await harness.flush();

    const runtimeLayout: OfficeSceneLayout = {
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: [
        { kind: "floor", tileId: 7, pattern: "environment.floors.pattern-02" },
        { kind: "wall", tileId: 8 },
      ],
      furniture: [
        {
          id: "desk-1",
          assetId: "desk",
          label: "Desk",
          category: "desks",
          placement: "floor",
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: 0xffffff,
          accentColor: 0x123456,
        },
      ],
      characters: [
        {
          id: "npc-1",
          label: "NPC",
          glyph: "@",
          col: 0,
          row: 1,
          color: 0xffffff,
          accentColor: 0,
        },
      ],
    };

    await act(async () => {
      harness.getState().syncFromRuntime(runtimeLayout);
    });

    expect(JSON.parse(harness.getState().jsonText)).toMatchObject({
      version: 2,
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: runtimeLayout.tiles,
      furniture: runtimeLayout.furniture,
      characters: runtimeLayout.characters,
    });
    expect(harness.getState()).toMatchObject({
      isDirty: true,
      parseError: null,
      statusText: "Unsaved",
    });

    await harness.unmount();
  });
});