import { describe, expect, test, vi } from "vitest";
import { createToolbarEntityPaletteBridge } from "../toolbarEntityPaletteBridge";

describe("createToolbarEntityPaletteBridge", () => {
  test("groups entity placeables and calls onSpawnEntity with the entity id on click", () => {
    const onSpawnEntity = vi.fn();
    const viewModel = createToolbarEntityPaletteBridge({
      placeables: [
        {
          id: "entity:player",
          type: "entity",
          entityId: "player",
          label: "Player Spawn",
          groupKey: "entity:player",
          groupLabel: "Player",
          previewFrameKey: null,
        },
        {
          id: "entity:npc.greeter",
          type: "entity",
          entityId: "npc.greeter",
          label: "Greeter",
          groupKey: "entity:npc",
          groupLabel: "Mobs",
          previewFrameKey: null,
        },
        {
          id: "entity:prop.static.set-01.variant-01",
          type: "entity",
          entityId: "prop.static.set-01.variant-01",
          label: "Variant 01",
          groupKey: "entity:prop:set-01",
          groupLabel: "Set 01",
          previewFrameKey: null,
        },
        {
          id: "terrain.ground.tile",
          type: "terrain",
          materialId: "ground",
          brushId: "ground",
          label: "Ground Tile Brush",
          groupKey: "terrain",
          groupLabel: "Terrain",
        },
      ],
      onSpawnEntity,
    });

    expect(viewModel).toEqual({
      groups: [
        {
          key: "entity:player",
          label: "Player",
          placeables: [
            {
              id: "entity:player",
              type: "entity",
              entityId: "player",
              label: "Player Spawn",
              groupKey: "entity:player",
              groupLabel: "Player",
              previewFrameKey: null,
            },
          ],
        },
        {
          key: "entity:npc",
          label: "Mobs",
          placeables: [
            {
              id: "entity:npc.greeter",
              type: "entity",
              entityId: "npc.greeter",
              label: "Greeter",
              groupKey: "entity:npc",
              groupLabel: "Mobs",
              previewFrameKey: null,
            },
          ],
        },
      ],
      onClick: expect.any(Function),
    });

    viewModel?.onClick(viewModel.groups[0]!.placeables[0]!);

    expect(onSpawnEntity).toHaveBeenCalledWith("player");
  });
});
