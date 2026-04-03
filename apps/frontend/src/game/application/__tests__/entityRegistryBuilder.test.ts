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
    const playerPlaceable = placeables.find(
      (p) => p.entityId === "player.female",
    );

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

  test("registers the first five office worker palettes as player placeables", () => {
    const catalog = buildAnimationCatalog([
      "characters.palette-0.office-worker.walk-down",
      "characters.palette-1.office-worker.walk-down",
      "characters.palette-2.office-worker.walk-down",
      "characters.palette-3.office-worker.walk-down",
      "characters.palette-4.office-worker.walk-down",
      "characters.palette-5.office-worker.walk-down",
    ]);
    const registry = buildEntityRegistryFromCatalog(catalog);
    const placeables = listEntityPlaceables(registry, catalog).filter(
      (placeable) => placeable.entityId.startsWith("player.office."),
    );

    expect(placeables).toEqual([
      {
        id: "entity:player.office.palette-0.office-worker",
        type: "entity",
        entityId: "player.office.palette-0.office-worker",
        label: "Office Worker 1",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: "characters.palette-0.office-worker.walk-down#0",
      },
      {
        id: "entity:player.office.palette-1.office-worker",
        type: "entity",
        entityId: "player.office.palette-1.office-worker",
        label: "Office Worker 2",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: "characters.palette-1.office-worker.walk-down#0",
      },
      {
        id: "entity:player.office.palette-2.office-worker",
        type: "entity",
        entityId: "player.office.palette-2.office-worker",
        label: "Office Worker 3",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: "characters.palette-2.office-worker.walk-down#0",
      },
      {
        id: "entity:player.office.palette-3.office-worker",
        type: "entity",
        entityId: "player.office.palette-3.office-worker",
        label: "Office Worker 4",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: "characters.palette-3.office-worker.walk-down#0",
      },
      {
        id: "entity:player.office.palette-4.office-worker",
        type: "entity",
        entityId: "player.office.palette-4.office-worker",
        label: "Office Worker 5",
        groupKey: "entity:player",
        groupLabel: "Player",
        previewFrameKey: "characters.palette-4.office-worker.walk-down#0",
      },
    ]);
    expect(
      readEntityVisualRef(
        registry.getById("player.office.palette-0.office-worker")!.visualRef,
      ),
    ).toBe("office/characters/palette-0/office-worker");
    expect(
      registry.getById("player.office.palette-5.office-worker"),
    ).toBeNull();
  });
});
