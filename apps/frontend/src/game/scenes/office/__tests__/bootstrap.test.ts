import { describe, expect, test } from "vitest";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
} from "../bootstrap";
import { resolveOfficeTileTint } from "../../../office/colors";

describe("createOfficeSceneBootstrap", () => {
  test("maps the checked-in Donarg office layout into scene data", () => {
    const bootstrap = createOfficeSceneBootstrap();
    const { layout } = bootstrap;

    expect(layout.cols).toBe(21);
    expect(layout.rows).toBe(21);
    expect(layout.tiles).toHaveLength(21 * 21);
    expect(layout.furniture).toHaveLength(56);
    expect(layout.characters).toHaveLength(6);

    expect(layout.tiles.filter((tile) => tile.kind === "wall")).toHaveLength(142);
    expect(layout.tiles.filter((tile) => tile.kind === "floor")).toHaveLength(299);

    expect(
      layout.furniture.some(
        (item) =>
          item.assetId === "ASSET_40" && item.label === "Snack Vending Machine",
      ),
    ).toBe(true);
    expect(
      layout.furniture.some(
        (item) => item.assetId === "ASSET_83" && item.label === "ASSET_83",
      ),
    ).toBe(true);

    expect(
      new Set(layout.characters.map((actor) => `${actor.col},${actor.row}`)).size,
    ).toBe(layout.characters.length);

    const floorTile = layout.tiles.find((tile) => tile.kind === "floor");
    expect(floorTile?.colorAdjust).toEqual({
      h: 214,
      s: 30,
      b: -100,
      c: -55,
    });
    expect(floorTile?.tint).toBe(resolveOfficeTileTint(floorTile?.colorAdjust ?? null, null));
  });

  test("accepts its own bootstrap shape through the registry parser", () => {
    const bootstrap = createOfficeSceneBootstrap();

    expect(getOfficeSceneBootstrap(bootstrap)).toEqual(bootstrap);
  });

  test("accepts expanded tile records with raw floor color metadata", () => {
    const bootstrap = {
      layout: {
        cols: 1,
        rows: 1,
        cellSize: 16,
        tiles: [
          {
            kind: "floor",
            tileId: 0,
            tint: 0x123456,
            colorAdjust: { h: 214, s: 30, b: -100, c: -55 },
            pattern: "environment.floors.pattern-01",
          },
        ],
        furniture: [],
        characters: [
          {
            id: "agent-1",
            label: "Agent 1",
            glyph: "A",
            col: 0,
            row: 0,
            color: 0x123456,
            accentColor: 0xffffff,
          },
        ],
      },
    };

    const parsed = getOfficeSceneBootstrap(bootstrap);
    expect(parsed).not.toBeNull();
    expect(parsed?.layout.tiles[0]).toMatchObject({
      kind: "floor",
      tileId: 0,
      pattern: "environment.floors.pattern-01",
      colorAdjust: { h: 214, s: 30, b: -100, c: -55 },
    });
    expect(parsed?.layout.tiles[0]?.tint).toBe(
      resolveOfficeTileTint({ h: 214, s: 30, b: -100, c: -55 }, 0x123456),
    );
  });
});
