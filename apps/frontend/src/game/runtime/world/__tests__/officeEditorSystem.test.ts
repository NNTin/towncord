import { describe, expect, test } from "vitest";
import { OfficeEditorSystem } from "../officeEditorSystem";
import type { OfficeSceneLayout } from "../../office/bootstrap";
import {
  resolveOfficeTileTint,
  resolveOfficeWallAppearance,
} from "../../../content/structures/colors";
import {
  FURNITURE_ALL_ITEMS,
  resolveFurnitureRotationVariant,
} from "../../../content/structures/furniturePalette";

const laptop = FURNITURE_ALL_ITEMS.find(
  (item) =>
    item.groupId === "LAPTOP" &&
    item.orientation === "front" &&
    item.state === "off",
);
const rotatingChair = FURNITURE_ALL_ITEMS.find(
  (item) => item.groupId === "ROTATING_CHAIR" && item.orientation === "front",
);

function findRotatableLargeAsset() {
  return FURNITURE_ALL_ITEMS.find(
    (item) => {
      const rotated = resolveFurnitureRotationVariant(item.id, 1);
      return (
        item.groupId &&
        item.orientation === "front" &&
        item.footprintW > 1 &&
        Boolean(rotated && rotated.id !== item.id && rotated.footprintH > 1)
      );
    },
  );
}

describe("OfficeEditorSystem floor editing", () => {
  test("stores the active floor pattern and raw color adjust when painting", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void",
          tileId: 0,
        },
      ],
      furniture: [],
      characters: [],
    };

    const floorColor = { h: 214, s: 30, b: -100, c: -55 };

    expect(
      system.applyCommand(layout, {
        tool: "floor",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor,
        wallColor: null,
        floorPattern: "environment.floors.pattern-03",
        furnitureId: null,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    const floorTile = layout.tiles[0];
    expect(floorTile).toBeDefined();
    if (!floorTile) {
      return;
    }

    expect(floorTile).toMatchObject({
      kind: "floor",
      pattern: "environment.floors.pattern-03",
      colorAdjust: floorColor,
    });
    expect(floorTile.tint).toBeTypeOf("number");
    expect(floorTile.colorAdjust).not.toBe(floorColor);
  });

  test("treats identical floor paints as no-ops", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "floor",
          tileId: 0,
          pattern: "environment.floors.pattern-01",
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          tint: resolveOfficeTileTint({ h: 35, s: 30, b: 15, c: 0 }, 0x475569) ?? 0x475569,
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "floor",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: { h: 35, s: 30, b: 15, c: 0 },
        wallColor: null,
        floorPattern: "environment.floors.pattern-01",
        furnitureId: null,
        rotationQuarterTurns: 0,
      }),
    ).toBe(false);
  });

  test("stores the active wall color and clears floor-only metadata when painting walls", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "floor",
          tileId: 0,
          tint: 0x445566,
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          pattern: "environment.floors.pattern-03",
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "wall",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor: { h: 214, s: 25, b: -54, c: 17 },
        floorPattern: null,
        furnitureId: null,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    expect(layout.tiles[0]).toMatchObject({
      kind: "wall",
      tileId: 8,
      colorAdjust: { h: 214, s: 25, b: -54, c: 17 },
    });
    expect(layout.tiles[0]?.tint).toBe(
      resolveOfficeWallAppearance({ h: 214, s: 25, b: -54, c: 17 }).tint,
    );
    expect(layout.tiles[0]).not.toHaveProperty("pattern");
  });

  test("treats identical wall paints as no-ops", () => {
    const system = new OfficeEditorSystem();
    const wallColor = { h: 214, s: 25, b: -54, c: 17 };
    const wallAppearance = resolveOfficeWallAppearance(wallColor);
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "wall",
          tileId: 8,
          tint: wallAppearance.tint,
          colorAdjust: wallAppearance.colorAdjust,
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "wall",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor,
        floorPattern: null,
        furnitureId: null,
        rotationQuarterTurns: 0,
      }),
    ).toBe(false);
  });

  test("erase normalizes stale floor metadata from void tiles", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void",
          tileId: 0,
          tint: 0x445566,
          colorAdjust: { h: 35, s: 30, b: 15, c: 0 },
          pattern: "environment.floors.pattern-03",
        },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "erase",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor: null,
        floorPattern: null,
        furnitureId: null,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    expect(layout.tiles[0]).toMatchObject({
      kind: "void",
      tileId: 0,
    });
    expect(layout.tiles[0]).not.toHaveProperty("tint");
    expect(layout.tiles[0]).not.toHaveProperty("colorAdjust");
    expect(layout.tiles[0]).not.toHaveProperty("pattern");
  });

  test("rotates furniture when a matching orientation variant exists", () => {
    const system = new OfficeEditorSystem();
    if (!laptop) {
      throw new Error("Missing laptop test asset");
    }

    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void",
          tileId: 0,
        },
      ],
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: laptop.footprintW,
          height: laptop.footprintH,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    expect(system.rotateFurniture(layout, "desk-laptop")).toBe(true);
    expect(layout.furniture[0]?.assetId).not.toBe(laptop.id);
  });

  test("places the rotated furniture variant selected in the active tool state", () => {
    const system = new OfficeEditorSystem();
    const asset = findRotatableLargeAsset();
    if (!asset) {
      throw new Error("Missing rotatable large test asset");
    }

    const rotatedAsset = resolveFurnitureRotationVariant(asset.id, 1);
    if (!rotatedAsset) {
      throw new Error("Missing rotated large test asset");
    }

    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: [
        { kind: "void", tileId: 0 },
        { kind: "void", tileId: 0 },
        { kind: "void", tileId: 0 },
        { kind: "void", tileId: 0 },
      ],
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "furniture",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor: null,
        floorPattern: null,
        furnitureId: asset.id,
        rotationQuarterTurns: 1,
      }),
    ).toBe(true);

    expect(layout.furniture[0]).toMatchObject({
      assetId: rotatedAsset.id,
      width: rotatedAsset.footprintW,
      height: rotatedAsset.footprintH,
      label: rotatedAsset.label,
    });
  });

  test("previews replace and blocked furniture placements before mutating the layout", () => {
    const system = new OfficeEditorSystem();
    const asset = findRotatableLargeAsset();
    if (!asset || !laptop || !rotatingChair) {
      throw new Error("Missing furniture preview test asset");
    }

    const replaceLayout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [{ kind: "void", tileId: 0 }],
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: laptop.footprintW,
          height: laptop.footprintH,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    expect(
      system.previewFurniturePlacement(
        replaceLayout,
        { col: 0, row: 0 },
        rotatingChair.id,
        0,
      ),
    ).toMatchObject({
      kind: "replace",
      affectedFurniture: [expect.objectContaining({ id: "desk-laptop" })],
      blockedReason: null,
    });

    expect(
      system.previewFurniturePlacement(
        {
          cols: 2,
          rows: 1,
          cellSize: 16,
          tiles: [
            { kind: "void", tileId: 0 },
            { kind: "void", tileId: 0 },
          ],
          furniture: [],
          characters: [],
        },
        { col: 0, row: 0 },
        asset.id,
        1,
      ),
    ).toMatchObject({
      kind: "blocked",
      blockedReason: "out-of-bounds",
    });
  });

  test("removes a selected furniture item by id without touching tiles", () => {
    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "wall",
          tileId: 8,
        },
      ],
      furniture: [
        {
          id: "desk-1",
          assetId: "ASSET_107",
          label: "Laptop - Front - Off",
          category: "electronics" as never,
          placement: "floor",
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: 0x111111,
          accentColor: 0x222222,
        },
      ],
      characters: [],
    };

    expect(system.removeFurniture(layout, "desk-1")).toBe(true);
    expect(layout.furniture).toHaveLength(0);
    expect(layout.tiles[0]?.kind).toBe("wall");
  });

  test("moves furniture to a free target cell and returns true", () => {
    if (!laptop) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 3,
      rows: 3,
      cellSize: 16,
      tiles: Array.from({ length: 9 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
      ],
      characters: [],
    };

    expect(system.moveFurniture(layout, "desk-laptop", { col: 2, row: 2 })).toBe(true);
    expect(layout.furniture[0]).toMatchObject({ id: "desk-laptop", col: 2, row: 2 });
  });

  test("moveFurniture returns false when target overlaps another furniture item", () => {
    if (!laptop || !rotatingChair) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 3,
      rows: 3,
      cellSize: 16,
      tiles: Array.from({ length: 9 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
        {
          id: "chair-1",
          assetId: rotatingChair.id,
          label: rotatingChair.label,
          category: rotatingChair.category as never,
          placement: rotatingChair.placement,
          col: 2,
          row: 2,
          width: 1,
          height: 1,
          color: rotatingChair.color ?? 0x000000,
          accentColor: rotatingChair.accentColor ?? 0x000000,
          renderAsset: { atlasKey: rotatingChair.atlasKey, atlasFrame: { ...rotatingChair.atlasFrame } },
        },
      ],
      characters: [],
    };

    // Trying to move laptop to where chair already sits
    expect(system.moveFurniture(layout, "desk-laptop", { col: 2, row: 2 })).toBe(false);
    expect(layout.furniture[0]).toMatchObject({ id: "desk-laptop", col: 0, row: 0 });
  });

  test("moveFurniture returns false when target is out of bounds", () => {
    if (!laptop) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 4 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
      ],
      characters: [],
    };

    expect(system.moveFurniture(layout, "desk-laptop", { col: 2, row: 0 })).toBe(false);
    expect(system.moveFurniture(layout, "desk-laptop", { col: -1, row: 0 })).toBe(false);
  });

  test("previewFurnitureMove returns a place preview for a valid free target cell", () => {
    if (!laptop) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 4,
      rows: 4,
      cellSize: 16,
      tiles: Array.from({ length: 16 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
      ],
      characters: [],
    };

    const preview = system.previewFurnitureMove(layout, "desk-laptop", { col: 2, row: 2 });
    expect(preview).toMatchObject({
      kind: "place",
      anchorCell: { col: 2, row: 2 },
      blockedReason: null,
      affectedFurniture: [],
    });
  });

  test("previewFurnitureMove returns a blocked preview when the target overlaps furniture", () => {
    if (!laptop || !rotatingChair) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 3,
      rows: 1,
      cellSize: 16,
      tiles: Array.from({ length: 3 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
        {
          id: "chair-1",
          assetId: rotatingChair.id,
          label: rotatingChair.label,
          category: rotatingChair.category as never,
          placement: rotatingChair.placement,
          col: 1,
          row: 0,
          width: 1,
          height: 1,
          color: rotatingChair.color ?? 0x000000,
          accentColor: rotatingChair.accentColor ?? 0x000000,
          renderAsset: { atlasKey: rotatingChair.atlasKey, atlasFrame: { ...rotatingChair.atlasFrame } },
        },
      ],
      characters: [],
    };

    expect(
      system.previewFurnitureMove(layout, "desk-laptop", { col: 1, row: 0 }),
    ).toMatchObject({
      kind: "blocked",
      blockedReason: "occupied",
      affectedFurniture: [expect.objectContaining({ id: "chair-1" })],
    });
  });

  test("previewFurnitureMove returns null when dragging within the current cell", () => {
    if (!laptop) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 4 }, () => ({ kind: "floor" as const, tileId: 0 })),
      furniture: [
        {
          id: "desk-laptop",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: { atlasKey: laptop.atlasKey, atlasFrame: { ...laptop.atlasFrame } },
        },
      ],
      characters: [],
    };

    expect(
      system.previewFurnitureMove(layout, "desk-laptop", { col: 0, row: 0 }),
    ).toBeNull();
  });
});
