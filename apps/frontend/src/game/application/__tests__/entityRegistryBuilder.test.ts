import { describe, expect, test } from "vitest";
import type { AnimationCatalog } from "../../content/asset-catalog/animationCatalog";
import { readEntityVisualRef } from "../../world/entities/model";
import { buildEntityRegistryFromCatalog } from "../entityRegistryBuilder";
import { listEntityPlaceables } from "../placeableService";

function createCatalog(): AnimationCatalog {
  return {
    entityTypes: ["mobs", "player"],
    playerModels: ["scout"],
    mobFamilies: ["animals"],
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
    expect(readEntityVisualRef(chicken!.visualRef)).toBe("mobs/animals/chicken");

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
});
