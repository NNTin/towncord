import { describe, expect, test, vi } from "vitest";
import { PLACE_DRAG_MIME, serializePlaceDragPayload } from "../../../../game";
import { createToolbarEntityPaletteBridge } from "../toolbarEntityPaletteBridge";

describe("createToolbarEntityPaletteBridge", () => {
  test("groups entity placeables, wires drag for players and spawn for mobs", () => {
    const spawnMob = vi.fn();
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
      spawnMob,
      spawnError: null,
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
      onDragStart: expect.any(Function),
      onSpawnMob: expect.any(Function),
      spawnError: null,
    });

    // Player entities still use the drag-and-drop flow.
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

    // Mob entities use click-to-spawn instead.
    viewModel?.onSpawnMob(viewModel.groups[1]!.placeables[0]!);
    expect(spawnMob).toHaveBeenCalledWith("npc.greeter");
  });

  test("forwards spawnError from params", () => {
    const viewModel = createToolbarEntityPaletteBridge({
      placeables: [
        {
          id: "entity:npc.bat",
          type: "entity",
          entityId: "npc.bat",
          label: "Bat",
          groupKey: "entity:npc",
          groupLabel: "Mobs",
          previewFrameKey: null,
        },
      ],
      spawnMob: vi.fn(),
      spawnError: "No barn.posts terrain found.",
    });

    expect(viewModel?.spawnError).toBe("No barn.posts terrain found.");
  });
});
