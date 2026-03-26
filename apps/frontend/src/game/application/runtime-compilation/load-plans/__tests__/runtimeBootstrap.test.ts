import { describe, expect, test } from "vitest";
import {
  composeRuntimeBootstrap,
  getWorldBootstrap,
} from "../runtimeBootstrap";

describe("runtime bootstrap compilation", () => {
  test("builds runtime bootstrap payloads from animation keys", () => {
    const bundle = composeRuntimeBootstrap([
      "mobs.bloomseed.animals.chicken.chicken-walk",
    ]);

    expect(bundle.ui.catalog).toBe(bundle.world.catalog);
    expect(getWorldBootstrap(bundle.world)).toEqual(bundle.world);
    expect(bundle.world.entityRegistry.getById("npc.animals.chicken")).toMatchObject(
      {
        id: "npc.animals.chicken",
        label: "chicken",
        kind: "npc",
      },
    );
    expect(bundle.ui.placeables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "entity:npc.animals.chicken",
          type: "entity",
          entityId: "npc.animals.chicken",
        }),
        expect.objectContaining({
          id: "terrain.water.tile",
          type: "terrain",
          materialId: "water",
          brushId: "water",
        }),
      ]),
    );
  });
});
