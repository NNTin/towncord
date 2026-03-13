import { describe, expect, test } from "vitest";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
} from "../bootstrap";

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
  });

  test("accepts its own bootstrap shape through the registry parser", () => {
    const bootstrap = createOfficeSceneBootstrap();

    expect(getOfficeSceneBootstrap(bootstrap)).toEqual(bootstrap);
  });
});
