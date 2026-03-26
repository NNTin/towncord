import { describe, expect, test } from "vitest";
import { OfficeEditorSystem } from "../officeEditorSystem";
import type { OfficeSceneLayout } from "../../office/bootstrap";
import { resolveOfficeTileTint } from "../../../content/structures/colors";

describe("OfficeEditorSystem floor editing", () => {
  test("stores the active floor pattern and raw color adjust when painting", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void",
          tileId: 0,
        },
      ],
      furniture: [],
      characters: [],
    };

    const floorColor = { h: 214, s: 30, b: -100, c: -55 };

    expect(
      system.applyCommand(layout, {
        tool: "floor",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor,
        floorPattern: "environment.floors.pattern-03",
        furnitureId: null,
      }),
    ).toBe(true);

    const floorTile = layout.tiles[0];
    expect(floorTile).toBeDefined();
    if (!floorTile) {
      return;
    }

    expect(floorTile).toMatchObject({
      kind: "floor",
      pattern: "environment.floors.pattern-03",
      colorAdjust: floorColor,
    });
    expect(floorTile.tint).toBeTypeOf("number");
    expect(floorTile.colorAdjust).not.toBe(floorColor);
  });

  test("treats identical floor paints as no-ops", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "floor",
          tileId: 0,
          pattern: "environment.floors.pattern-01",
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          tint: resolveOfficeTileTint({ h: 35, s: 30, b: 15, c: 0 }, 0x475569) ?? 0x475569,
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "floor",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: { h: 35, s: 30, b: 15, c: 0 },
        floorPattern: "environment.floors.pattern-01",
        furnitureId: null,
      }),
    ).toBe(false);
  });

  test("clears floor-only metadata when converting a floor tile to a wall", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "floor",
          tileId: 0,
          tint: 0x445566,
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          pattern: "environment.floors.pattern-03",
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "wall",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        floorPattern: null,
        furnitureId: null,
      }),
    ).toBe(true);

    expect(layout.tiles[0]).toMatchObject({
      kind: "wall",
      tileId: 0,
    });
    expect(layout.tiles[0]).not.toHaveProperty("tint");
    expect(layout.tiles[0]).not.toHaveProperty("colorAdjust");
    expect(layout.tiles[0]).not.toHaveProperty("pattern");
  });

  test("erase normalizes stale floor metadata from void tiles", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void",
          tileId: 0,
          tint: 0x445566,
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          pattern: "environment.floors.pattern-03",
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "erase",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        floorPattern: null,
        furnitureId: null,
      }),
    ).toBe(true);

    expect(layout.tiles[0]).toMatchObject({
      kind: "void",
      tileId: 0,
    });
    expect(layout.tiles[0]).not.toHaveProperty("tint");
    expect(layout.tiles[0]).not.toHaveProperty("colorAdjust");
    expect(layout.tiles[0]).not.toHaveProperty("pattern");
  });
});
