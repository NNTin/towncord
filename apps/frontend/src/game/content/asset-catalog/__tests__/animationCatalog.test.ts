import { describe, expect, test } from "vitest";
import {
  buildAnimationCatalog,
  getOfficeCharacterIds,
  getOfficeCharacterPalettes,
  getOfficeEnvironmentGroups,
  getOfficeFurnitureGroups,
  getPropGroups,
  getTilesetGroups,
  getTracksForPath,
  listPropDescriptors,
  listOfficeCharacterDescriptors,
  resolveTrackForDirection,
} from "../animationCatalog";

describe("animationCatalog", () => {
  test("parses bloomseed and farmrpg player models alongside farmrpg npc families", () => {
    const catalog = buildAnimationCatalog([
      "characters.bloomseed.player.female.walk.walk-down",
      "characters.farmrpg.player.default.idle.down",
      "characters.farmrpg.npc.child.walk.down",
      "characters.farmrpg.npc.child.walk.right",
    ]);

    expect(catalog.entityTypes).toEqual(["npcs", "player"]);
    expect(catalog.playerModels).toEqual(["farmrpg-default", "female"]);
    expect(catalog.npcFamilies).toEqual(["child"]);
    expect(
      getTracksForPath(catalog, "player/female").map((track) => track.id),
    ).toEqual(["walk"]);
    expect(
      getTracksForPath(catalog, "player/farmrpg-default").map(
        (track) => track.id,
      ),
    ).toEqual(["idle"]);
    expect(
      getTracksForPath(catalog, "npcs/child").map((track) => track.id),
    ).toEqual(["walk"]);
  });

  test("parses props into prop families and groups", () => {
    const catalog = buildAnimationCatalog([
      "props.bloomseed.animated.chest.black-chest",
      "props.bloomseed.animated.water.lily-pad",
      "props.bloomseed.static.tables.variant-01",
      "props.farmrpg.static.set-01.variant-01",
    ]);

    expect(catalog.entityTypes).toContain("props");
    expect(catalog.propFamilies).toEqual(["animated", "static"]);
    expect(getPropGroups(catalog, "animated")).toEqual(["chest", "water"]);
    expect(getPropGroups(catalog, "static")).toEqual(["set-01", "tables"]);
    expect(
      getTracksForPath(catalog, "props/static/tables").map((track) => track.id),
    ).toEqual(["variant-01"]);
    expect(listPropDescriptors(catalog)).toContainEqual({
      family: "static",
      group: "set-01",
      propId: "variant-01",
      visualPath: "props/static/set-01",
      animationId: "props.farmrpg.static.set-01.variant-01",
    });
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
    expect(getTilesetGroups(catalog, "static")).toEqual([
      "environment",
      "structure",
    ]);
    expect(getTilesetGroups(catalog, "animated")).toEqual(["environment"]);
    expect(
      getTracksForPath(catalog, "tilesets/static/environment").map(
        (track) => track.id,
      ),
    ).toEqual(["grass-tileset", "water-tileset"]);
    expect(
      getTracksForPath(catalog, "tilesets/static/structure").map(
        (track) => track.id,
      ),
    ).toEqual(["walls-and-floors"]);
    expect(
      getTracksForPath(catalog, "tilesets/animated/environment").map(
        (track) => track.id,
      ),
    ).toEqual(["water-tileset-vfx"]);
  });

  test("parses Donarg office characters and office asset groups without polluting bloomseed entity selectors", () => {
    const catalog = buildAnimationCatalog([
      "characters.palette-0.office-worker.walk-down",
      "characters.palette-0.office-worker.walk-right",
      "characters.palette-0.office-worker.read-up",
      "characters.palette-1.office-worker.walk-down",
      "environment.floors.pattern-01",
      "environment.walls.mask-00",
      "furniture.chairs.chair-cushioned-front",
      "furniture.desks.counter-wood-md",
    ]);

    expect(catalog.entityTypes).toEqual([]);
    expect(getOfficeCharacterPalettes(catalog)).toEqual([
      "palette-0",
      "palette-1",
    ]);
    expect(catalog.officeCharacterIds).toEqual(["office-worker"]);
    expect(getOfficeCharacterIds(catalog, "palette-0")).toEqual([
      "office-worker",
    ]);
    expect(getOfficeEnvironmentGroups(catalog)).toEqual(["floors", "walls"]);
    expect(getOfficeFurnitureGroups(catalog)).toEqual(["chairs", "desks"]);
    expect(listOfficeCharacterDescriptors(catalog)).toEqual([
      {
        palette: "palette-0",
        characterId: "office-worker",
        visualPath: "office/characters/palette-0/office-worker",
      },
      {
        palette: "palette-1",
        characterId: "office-worker",
        visualPath: "office/characters/palette-1/office-worker",
      },
    ]);
    expect(
      getTracksForPath(
        catalog,
        "office/characters/palette-0/office-worker",
      ).map((track) => track.id),
    ).toEqual(["read", "walk"]);
  });

  test("resolves horizontal office-character tracks from right-facing exports and flips left", () => {
    const catalog = buildAnimationCatalog([
      "characters.palette-0.office-worker.walk-down",
      "characters.palette-0.office-worker.walk-right",
      "characters.palette-0.office-worker.walk-up",
    ]);

    const track = getTracksForPath(
      catalog,
      "office/characters/palette-0/office-worker",
    ).find((item) => item.id === "walk");

    expect(track).toBeTruthy();
    expect(resolveTrackForDirection(track!, "right")).toEqual({
      key: "characters.palette-0.office-worker.walk-right",
      flipX: false,
    });
    expect(resolveTrackForDirection(track!, "left")).toEqual({
      key: "characters.palette-0.office-worker.walk-right",
      flipX: true,
    });
  });
});
