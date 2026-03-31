import { describe, expect, test } from "vitest";
import type { AnimationCatalog } from "../../content/asset-catalog/animationCatalog";
import { buildAnimationCatalog } from "../../content/asset-catalog/animationCatalog";
import { readEntityVisualRef } from "../../world/entities/model";
import { buildEntityRegistryFromCatalog } from "../entityRegistryBuilder";
import { listEntityPlaceables } from "../placeableService";

function createCatalog(): AnimationCatalog {
  return {
    entityTypes: ["mobs", "player"],
    playerModels: ["scout"],
    mobFamilies: ["animals"],
    npcFamilies: [],
    propFamilies: [],
    tilesetFamilies: ["animated", "static"],
    officeCharacterPalettes: [],
    officeCharacterIds: [],
    officeEnvironmentGroups: [],
    officeFurnitureGroups: [],
    tracksByPath: new Map([
      ["mobs/animals/chicken", []],
      ["mobs/animals/cow", []],
    ]),
  };
}

describe("entityRegistryBuilder", () => {
  test("preserves runtime entity definitions and placeable groups", () => {
    const registry = buildEntityRegistryFromCatalog(createCatalog());
    const player = registry.getById("player.scout");
    const chicken = registry.getById("npc.animals.chicken");

    expect(player).not.toBeNull();
    expect(player).toMatchObject({
      id: "player.scout",
      label: "scout",
      kind: "player",
      capabilities: ["idle", "walk", "run"],
      placeable: true,
    });
    expect(readEntityVisualRef(player!.visualRef)).toBe("player/scout");

    expect(chicken).not.toBeNull();
    expect(chicken).toMatchObject({
      id: "npc.animals.chicken",
      label: "chicken",
      kind: "npc",
      capabilities: ["idle", "walk"],
      placeable: true,
    });
    expect(readEntityVisualRef(chicken!.visualRef)).toBe(
      "mobs/animals/chicken",
    );

    const catalog = createCatalog();
    expect(listEntityPlaceables(registry, catalog)).toEqual([
      {
        id: "entity:player.scout",
        type: "entity",
        entityId: "player.scout",
        label: "scout",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: null,
      },
      {
        id: "entity:npc.animals.chicken",
        type: "entity",
        entityId: "npc.animals.chicken",
        label: "chicken",
        groupKey: "entity:npc",
        groupLabel: "Mobs",
        previewFrameKey: null,
      },
      {
        id: "entity:npc.animals.cow",
        type: "entity",
        entityId: "npc.animals.cow",
        label: "cow",
        groupKey: "entity:npc",
        groupLabel: "Mobs",
        previewFrameKey: null,
      },
    ]);
  });

  test("resolves previewFrameKey for bloomseed player using idle-down track", () => {
    const catalog = buildAnimationCatalog([
      "characters.bloomseed.player.female.idle.idle-down",
      "characters.bloomseed.player.female.walk.walk-down",
    ]);
    const registry = buildEntityRegistryFromCatalog(catalog);
    const placeables = listEntityPlaceables(registry, catalog);
    const playerPlaceable = placeables.find((p) => p.entityId === "player.female");

    expect(playerPlaceable).toBeDefined();
    expect(playerPlaceable?.previewFrameKey).toBe(
      "characters.bloomseed.player.female.idle.idle-down#0",
    );
  });

  test("resolves previewFrameKey for farmrpg-default player using idle-down track", () => {
    const catalog = buildAnimationCatalog([
      "characters.farmrpg.player.default.idle.down",
      "characters.farmrpg.player.default.walk.down",
    ]);
    const registry = buildEntityRegistryFromCatalog(catalog);
    const placeables = listEntityPlaceables(registry, catalog);
    const playerPlaceable = placeables.find(
      (p) => p.entityId === "player.farmrpg-default",
    );

    expect(playerPlaceable).toBeDefined();
    expect(playerPlaceable?.previewFrameKey).toBe(
      "characters.farmrpg.player.default.idle.down#0",
    );
  });
});
