import { describe, expect, test } from "vitest";
import type { OfficeSceneLayout } from "../../../officeLayoutContract";
import {
  formatOfficeLayout,
  syncFromRuntimeLayout,
  type OfficeLayoutDocument,
} from "../officeLayoutDocument";

describe("document export office layout translation", () => {
  test("formats office layout documents as stable JSON", () => {
    const document: OfficeLayoutDocument = {
      version: 2,
      cols: 2,
      rows: 1,
      cellSize: 16,
      tiles: [0, 1],
      furniture: [],
      characters: [],
    };

    expect(formatOfficeLayout(document)).toBe(
      `${JSON.stringify(document, null, 2)}\n`,
    );
  });

  test("syncs runtime layouts back into persisted documents", () => {
    const runtimeLayout: OfficeSceneLayout = {
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: [
        {
          kind: "floor",
          tileId: 7,
          pattern: "environment.floors.pattern-02",
        },
        { kind: "wall", tileId: 8 },
      ],
      furniture: [],
      characters: [],
    };

    expect(syncFromRuntimeLayout(runtimeLayout)).toEqual({
      version: 2,
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: runtimeLayout.tiles,
      furniture: [],
      characters: [],
    });
  });

  test("preserves an existing anchor while syncing runtime layouts", () => {
    const runtimeLayout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [{ kind: "floor", tileId: 0 }],
      furniture: [],
      characters: [],
    };

    expect(
      syncFromRuntimeLayout(runtimeLayout, {
        version: 2,
        cols: 1,
        rows: 1,
        cellSize: 16,
        anchor: { x: 4, y: 7 },
        tiles: [],
        furniture: [],
        characters: [],
      }),
    ).toEqual({
      version: 2,
      anchor: { x: 4, y: 7 },
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: runtimeLayout.tiles,
      furniture: [],
      characters: [],
    });
  });
});
