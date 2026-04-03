import { describe, expect, test } from "vitest";
import { createTerrainPropPaletteBridge } from "../toolbarPropPaletteBridge";

describe("createTerrainPropPaletteBridge", () => {
  test("groups prop entities and excludes non-prop placeables", () => {
    const viewModel = createTerrainPropPaletteBridge({
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
          id: "entity:prop.static.set-01.variant-01",
          type: "entity",
          entityId: "prop.static.set-01.variant-01",
          label: "Variant 01",
          groupKey: "entity:prop:set-01",
          groupLabel: "Set 01",
          previewFrameKey: null,
        },
      ],
    });

    expect(viewModel).toEqual({
      groups: [
        {
          key: "entity:prop:set-01",
          label: "Set 01",
          placeables: [
            {
              id: "entity:prop.static.set-01.variant-01",
              type: "entity",
              entityId: "prop.static.set-01.variant-01",
              label: "Variant 01",
              groupKey: "entity:prop:set-01",
              groupLabel: "Set 01",
              previewFrameKey: null,
            },
          ],
        },
      ],
    });
  });
});
