import { describe, expect, test, vi } from "vitest";
import { PLACE_DRAG_MIME, serializePlaceDragPayload } from "../../../../game";
import { createToolbarEntityPaletteBridge } from "../toolbarEntityPaletteBridge";

describe("createToolbarEntityPaletteBridge", () => {
  test("groups entity placeables and reuses the existing drag payload flow", () => {
    const viewModel = createToolbarEntityPaletteBridge({
      placeables: [
        {
          id: "entity:player",
          type: "entity",
          entityId: "player",
          label: "Player Spawn",
          groupKey: "entity:player",
          groupLabel: "Player",
        },
        {
          id: "entity:npc.greeter",
          type: "entity",
          entityId: "npc.greeter",
          label: "Greeter",
          groupKey: "entity:npc",
          groupLabel: "Mobs",
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
            },
          ],
        },
      ],
      onDragStart: expect.any(Function),
    });

    const dataTransfer = {
      effectAllowed: "none",
      setData: vi.fn(),
    };

    viewModel?.onDragStart(
      { dataTransfer } as never,
      viewModel.groups[0]!.placeables[0]!,
    );

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      PLACE_DRAG_MIME,
      serializePlaceDragPayload({
        type: "entity",
        entityId: "player",
      }),
    );
    expect(dataTransfer.effectAllowed).toBe("copy");
  });
});
