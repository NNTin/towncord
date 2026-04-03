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
import { resolvePropPaletteItem } from "../../../content/structures/propPalette";

const laptop = FURNITURE_ALL_ITEMS.find(
  (item) =>
    item.groupId === "LAPTOP" &&
    item.orientation === "front" &&
    item.state === "off",
);
const rotatingChair = FURNITURE_ALL_ITEMS.find(
  (item) => item.groupId === "ROTATING_CHAIR" && item.orientation === "front",
);
const floorDecor = FURNITURE_ALL_ITEMS.find(
  (item) => item.category === "decor" && item.placement === "floor",
);
const floorDecorMat = FURNITURE_ALL_ITEMS.find(
  (item) =>
    item.category === "decor" &&
    item.placement === "floor" &&
    item.footprintW === 2 &&
    item.footprintH === 1,
);
const floorDesk = FURNITURE_ALL_ITEMS.find(
  (item) => item.category === "desks" && item.placement === "floor",
);
const farmrpgProp = resolvePropPaletteItem("prop.static.set-01.variant-01");

function findRotatableLargeAsset() {
  return FURNITURE_ALL_ITEMS.find((item) => {
    const rotated = resolveFurnitureRotationVariant(item.id, 1);
    return (
      item.groupId &&
      item.orientation === "front" &&
      item.footprintW > 1 &&
      Boolean(rotated && rotated.id !== item.id && rotated.footprintH > 1)
    );
  });
}

function createFurnitureItem(
  overrides: Partial<OfficeSceneLayout["furniture"][number]>,
): OfficeSceneLayout["furniture"][number] {
  return {
    id: "furniture",
    assetId: "asset",
    label: "Furniture",
    category: "decor" as never,
    placement: "floor",
    col: 0,
    row: 0,
    width: 1,
    height: 1,
    color: 0x111111,
    accentColor: 0x222222,
    ...overrides,
  };
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
          tint:
            resolveOfficeTileTint({ h: 35, s: 30, b: 15, c: 0 }, 0x475569) ??
            0x475569,
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

  test("previews replacement only for overlaps that will actually be removed", () => {
    const system = new OfficeEditorSystem();
    const asset = findRotatableLargeAsset();
    if (!asset || !laptop || !rotatingChair || !floorDecor) {
      throw new Error("Missing furniture preview test asset");
    }

    const replaceLayout: OfficeSceneLayout = {
      cols: 3,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 6 }, () => ({
        kind: "void" as const,
        tileId: 0,
      })),
      furniture: [
        createFurnitureItem({
          id: "same-decor",
          assetId: floorDecor.id,
          label: floorDecor.label,
          category: floorDecor.category as never,
          placement: floorDecor.placement,
          width: floorDecor.footprintW,
          height: floorDecor.footprintH,
          color: floorDecor.color,
          accentColor: floorDecor.accentColor,
          renderAsset: {
            atlasKey: floorDecor.atlasKey,
            atlasFrame: { ...floorDecor.atlasFrame },
          },
        }),
        createFurnitureItem({
          id: "electronics",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          width: laptop.footprintW,
          height: laptop.footprintH,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        }),
      ],
      characters: [],
    };

    expect(
      system.previewFurniturePlacement(
        replaceLayout,
        { col: 0, row: 0 },
        floorDecor.id,
        0,
      ),
    ).toMatchObject({
      kind: "replace",
      affectedFurniture: [expect.objectContaining({ id: "same-decor" })],
      blockedReason: null,
    });

    expect(
      system.previewFurniturePlacement(
        replaceLayout,
        { col: 0, row: 0 },
        rotatingChair.id,
        0,
      ),
    ).toMatchObject({
      kind: "replace",
      affectedFurniture: expect.arrayContaining([
        expect.objectContaining({ id: "same-decor" }),
        expect.objectContaining({ id: "electronics" }),
      ]),
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

  test("placement mutates only the furniture that the active category is allowed to replace", () => {
    if (!laptop || !floorDecor || !floorDesk) {
      throw new Error("Missing furniture placement test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 3,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 6 }, () => ({
        kind: "void" as const,
        tileId: 0,
      })),
      furniture: [
        createFurnitureItem({
          id: "same-decor",
          assetId: floorDecor.id,
          label: floorDecor.label,
          category: floorDecor.category as never,
          placement: floorDecor.placement,
          col: 0,
          row: 0,
          width: floorDecor.footprintW,
          height: floorDecor.footprintH,
          color: floorDecor.color,
          accentColor: floorDecor.accentColor,
          renderAsset: {
            atlasKey: floorDecor.atlasKey,
            atlasFrame: { ...floorDecor.atlasFrame },
          },
        }),
        createFurnitureItem({
          id: "electronics",
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
        }),
        createFurnitureItem({
          id: "desk",
          assetId: floorDesk.id,
          label: floorDesk.label,
          category: floorDesk.category as never,
          placement: floorDesk.placement,
          col: 0,
          row: 0,
          width: floorDesk.footprintW,
          height: floorDesk.footprintH,
          color: floorDesk.color,
          accentColor: floorDesk.accentColor,
          renderAsset: {
            atlasKey: floorDesk.atlasKey,
            atlasFrame: { ...floorDesk.atlasFrame },
          },
        }),
      ],
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
        furnitureId: floorDecor.id,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    expect(layout.furniture).toHaveLength(3);
    expect(layout.furniture[0]?.id).toBe("electronics");
    expect(layout.furniture[1]?.id).toBe("desk");
    expect(layout.furniture[2]?.id).toMatch(/^placed-/);

    expect(
      system.applyCommand(layout, {
        tool: "furniture",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor: null,
        floorPattern: null,
        furnitureId: floorDesk.id,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    expect(layout.furniture).toHaveLength(1);
    expect(layout.furniture[0]?.category).toBe("desks");
  });

  test("places FarmRPG props into the office layout with a props category and texture key", () => {
    if (!farmrpgProp) {
      throw new Error("Missing FarmRPG prop test asset");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 4 }, () => ({
        kind: "void" as const,
        tileId: 0,
      })),
      furniture: [],
      characters: [],
    };

    expect(
      system.applyCommand(layout, {
        tool: "prop",
        cell: { col: 0, row: 0 },
        tileColor: null,
        floorColor: null,
        wallColor: null,
        floorPattern: null,
        furnitureId: null,
        propId: farmrpgProp.id,
        rotationQuarterTurns: 0,
      }),
    ).toBe(true);

    expect(layout.furniture[0]).toMatchObject({
      assetId: farmrpgProp.id,
      category: "props",
      placement: "floor",
      renderAsset: {
        textureKey: "farmrpg.props",
        atlasKey: farmrpgProp.atlasKey,
      },
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
      tiles: Array.from({ length: 9 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
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
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    expect(
      system.moveFurniture(layout, "desk-laptop", { col: 2, row: 2 }),
    ).toBe(true);
    expect(layout.furniture[0]).toMatchObject({
      id: "desk-laptop",
      col: 2,
      row: 2,
    });
  });

  test("moveFurniture allows coexist with different categories and blocks same-category overlaps", () => {
    if (!laptop) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 6,
      rows: 1,
      cellSize: 16,
      tiles: Array.from({ length: 6 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
      furniture: [
        createFurnitureItem({
          id: "moving-decor",
          assetId: "decor-a",
          label: "Decor A",
          category: "decor" as never,
          placement: "floor",
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          color: 0x335533,
          accentColor: 0x99cc99,
        }),
        createFurnitureItem({
          id: "blocking-decor",
          assetId: "decor-b",
          label: "Decor B",
          category: "decor" as never,
          placement: "floor",
          col: 1,
          row: 0,
          width: 1,
          height: 1,
          color: 0x335533,
          accentColor: 0x99cc99,
        }),
        createFurnitureItem({
          id: "electronics",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 2,
          row: 0,
          width: laptop.footprintW,
          height: laptop.footprintH,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        }),
        createFurnitureItem({
          id: "moving-desk",
          assetId: "desk-a",
          label: "Desk",
          category: "desks" as never,
          placement: "floor",
          col: 3,
          row: 0,
          width: 1,
          height: 1,
          color: 0x444444,
          accentColor: 0x888888,
        }),
      ],
      characters: [],
    };

    expect(
      system.moveFurniture(layout, "moving-decor", { col: 2, row: 0 }),
    ).toBe(true);
    expect(layout.furniture[0]).toMatchObject({
      id: "moving-decor",
      col: 2,
      row: 0,
    });

    expect(
      system.moveFurniture(layout, "moving-decor", { col: 1, row: 0 }),
    ).toBe(false);
    expect(layout.furniture[0]).toMatchObject({
      id: "moving-decor",
      col: 2,
      row: 0,
    });

    expect(
      system.moveFurniture(layout, "moving-desk", { col: 2, row: 0 }),
    ).toBe(false);
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
      tiles: Array.from({ length: 4 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
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
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    expect(
      system.moveFurniture(layout, "desk-laptop", { col: 2, row: 0 }),
    ).toBe(false);
    expect(
      system.moveFurniture(layout, "desk-laptop", { col: -1, row: 0 }),
    ).toBe(false);
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
      tiles: Array.from({ length: 16 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
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
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    const preview = system.previewFurnitureMove(layout, "desk-laptop", {
      col: 2,
      row: 2,
    });
    expect(preview).toMatchObject({
      kind: "place",
      anchorCell: { col: 2, row: 2 },
      blockedReason: null,
      affectedFurniture: [],
    });
  });

  test("previewFurnitureMove allows overlapping different categories but blocks same-category overlaps", () => {
    if (!laptop || !floorDecorMat) {
      throw new Error("Missing test assets");
    }

    const system = new OfficeEditorSystem();
    const layout: OfficeSceneLayout = {
      cols: 6,
      rows: 1,
      cellSize: 16,
      tiles: Array.from({ length: 6 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
      furniture: [
        createFurnitureItem({
          id: "moving-decor",
          assetId: floorDecorMat.id,
          label: floorDecorMat.label,
          category: floorDecorMat.category as never,
          placement: floorDecorMat.placement,
          col: 0,
          row: 0,
          width: floorDecorMat.footprintW,
          height: floorDecorMat.footprintH,
          color: floorDecorMat.color,
          accentColor: floorDecorMat.accentColor,
          renderAsset: {
            atlasKey: floorDecorMat.atlasKey,
            atlasFrame: { ...floorDecorMat.atlasFrame },
          },
        }),
        createFurnitureItem({
          id: "same-decor",
          assetId: floorDecorMat.id,
          label: floorDecorMat.label,
          category: floorDecorMat.category as never,
          placement: floorDecorMat.placement,
          col: 4,
          row: 0,
          width: floorDecorMat.footprintW,
          height: floorDecorMat.footprintH,
          color: floorDecorMat.color,
          accentColor: floorDecorMat.accentColor,
          renderAsset: {
            atlasKey: floorDecorMat.atlasKey,
            atlasFrame: { ...floorDecorMat.atlasFrame },
          },
        }),
        createFurnitureItem({
          id: "electronics",
          assetId: laptop.id,
          label: laptop.label,
          category: laptop.category as never,
          placement: laptop.placement,
          col: 2,
          row: 0,
          width: laptop.footprintW,
          height: laptop.footprintH,
          color: laptop.color,
          accentColor: laptop.accentColor,
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        }),
      ],
      characters: [],
    };

    expect(
      system.previewFurnitureMove(layout, "moving-decor", { col: 2, row: 0 }),
    ).toMatchObject({
      kind: "place",
      blockedReason: null,
      affectedFurniture: [],
    });

    expect(
      system.previewFurnitureMove(layout, "moving-decor", { col: 4, row: 0 }),
    ).toMatchObject({
      kind: "blocked",
      blockedReason: "occupied",
      affectedFurniture: [expect.objectContaining({ id: "same-decor" })],
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
      tiles: Array.from({ length: 4 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
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
          renderAsset: {
            atlasKey: laptop.atlasKey,
            atlasFrame: { ...laptop.atlasFrame },
          },
        },
      ],
      characters: [],
    };

    expect(
      system.previewFurnitureMove(layout, "desk-laptop", { col: 0, row: 0 }),
    ).toBeNull();
  });
});
