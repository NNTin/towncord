import { describe, expect, test } from "vitest";
import {
  buildAnimationCatalog,
  getPropGroups,
  getTilesetGroups,
  getTracksForPath,
} from "../animationCatalog";

describe("animationCatalog", () => {
  test("parses props into prop families and groups", () => {
    const catalog = buildAnimationCatalog([
      "props.bloomseed.animated.chest.black-chest",
      "props.bloomseed.animated.water.lily-pad",
      "props.bloomseed.static.tables.variant-01",
    ]);

    expect(catalog.entityTypes).toContain("props");
    expect(catalog.propFamilies).toEqual(["animated", "static"]);
    expect(getPropGroups(catalog, "animated")).toEqual(["chest", "water"]);
    expect(getTracksForPath(catalog, "props/static/tables").map((track) => track.id)).toEqual([
      "variant-01",
    ]);
  });

  test("parses tilesets as a separate entity type", () => {
    const catalog = buildAnimationCatalog([
      "tilesets.bloomseed.environment.water-tileset",
      "tilesets.bloomseed.environment.grass-tileset",
      "tilesets.bloomseed.structure.walls-and-floors",
      "tilesets.bloomseed.animated.environment.water-tileset-vfx",
    ]);

    expect(catalog.entityTypes).toEqual(["tilesets"]);
    expect(catalog.tilesetFamilies).toEqual(["animated", "static"]);
    expect(getTilesetGroups(catalog, "static")).toEqual(["environment", "structure"]);
    expect(getTilesetGroups(catalog, "animated")).toEqual(["environment"]);
    expect(
      getTracksForPath(catalog, "tilesets/static/environment").map((track) => track.id),
    ).toEqual(["grass-tileset", "water-tileset"]);
    expect(
      getTracksForPath(catalog, "tilesets/static/structure").map((track) => track.id),
    ).toEqual(["walls-and-floors"]);
    expect(
      getTracksForPath(catalog, "tilesets/animated/environment").map((track) => track.id),
    ).toEqual(["water-tileset-vfx"]);
  });
});
