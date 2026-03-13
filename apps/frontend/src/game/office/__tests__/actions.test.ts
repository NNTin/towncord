import { describe, expect, test } from "vitest";
import {
  canPlaceCharacter,
  canPlaceFurniture,
  expandLayout,
  getWallPlacementRow,
  moveCharacter,
  placeCharacter,
  placeFurniture,
} from "../actions";
import { buildOfficeFurnitureCatalogIndex } from "../catalog";
import {
  OfficeTileType,
  type OfficeFurnitureCatalogAsset,
  type OfficeLayoutDocument,
} from "../model";

const ASSETS: OfficeFurnitureCatalogAsset[] = [
  {
    id: "DESK_FRONT",
    label: "Desk - Front",
    category: "desks",
    file: "desk-front.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
  },
  {
    id: "LAPTOP_FRONT",
    label: "Laptop - Front",
    category: "electronics",
    file: "laptop-front.png",
    width: 16,
    height: 16,
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: true,
  },
  {
    id: "WHITEBOARD",
    label: "Whiteboard",
    category: "wall",
    file: "whiteboard.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: false,
    canPlaceOnWalls: true,
  },
];

function createLayout(): OfficeLayoutDocument {
  return {
    version: 1,
    cols: 4,
    rows: 4,
    tiles: [
      OfficeTileType.WALL, OfficeTileType.WALL, OfficeTileType.WALL, OfficeTileType.WALL,
      OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1,
      OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1, OfficeTileType.FLOOR_1,
      OfficeTileType.VOID, OfficeTileType.VOID, OfficeTileType.VOID, OfficeTileType.VOID,
    ],
    furniture: [],
    characters: [],
  };
}

describe("office actions", () => {
  test("allows placing surface items on desks and rejects them off-desk", () => {
    const catalog = buildOfficeFurnitureCatalogIndex(ASSETS);
    const withDesk = placeFurniture(createLayout(), catalog, {
      uid: "desk-1",
      type: "DESK_FRONT",
      col: 1,
      row: 1,
    });

    expect(canPlaceFurniture(withDesk, catalog, "LAPTOP_FRONT", 1, 1)).toBe(true);
    expect(canPlaceFurniture(withDesk, catalog, "LAPTOP_FRONT", 0, 1)).toBe(false);
  });

  test("computes wall placement rows and validates wall-mounted items", () => {
    const catalog = buildOfficeFurnitureCatalogIndex(ASSETS);
    const row = getWallPlacementRow(catalog, "WHITEBOARD", 0);

    expect(row).toBe(-1);
    expect(canPlaceFurniture(createLayout(), catalog, "WHITEBOARD", 1, row)).toBe(true);
    expect(canPlaceFurniture(createLayout(), catalog, "WHITEBOARD", 0, 1)).toBe(false);
  });

  test("expands layout and shifts furniture and characters when growing left or up", () => {
    const catalog = buildOfficeFurnitureCatalogIndex(ASSETS);
    const layout = placeCharacter(
      placeFurniture(createLayout(), catalog, {
        uid: "desk-1",
        type: "DESK_FRONT",
        col: 1,
        row: 1,
      }),
      catalog,
      {
        uid: "char-1",
        characterType: "office-worker",
        palette: "palette-0",
        pose: "walk",
        direction: "down",
        col: 0,
        row: 1,
      },
    );

    const expanded = expandLayout(layout, "left");
    expect(expanded.shift).toEqual({ col: 1, row: 0 });
    expect(expanded.layout.furniture[0]).toMatchObject({ col: 2, row: 1 });
    expect(expanded.layout.characters?.[0]).toMatchObject({ col: 1, row: 1 });
  });

  test("blocks character placement on occupied furniture tiles and allows free floor tiles", () => {
    const catalog = buildOfficeFurnitureCatalogIndex(ASSETS);
    const withDesk = placeFurniture(createLayout(), catalog, {
      uid: "desk-1",
      type: "DESK_FRONT",
      col: 1,
      row: 1,
    });

    expect(canPlaceCharacter(withDesk, catalog, 1, 1)).toBe(false);
    expect(canPlaceCharacter(withDesk, catalog, 0, 1)).toBe(true);
  });

  test("moves characters across valid tiles", () => {
    const catalog = buildOfficeFurnitureCatalogIndex(ASSETS);
    const withCharacter = placeCharacter(createLayout(), catalog, {
      uid: "char-1",
      characterType: "office-worker",
      palette: "palette-0",
      pose: "idle",
      direction: "down",
      col: 0,
      row: 1,
    });

    const moved = moveCharacter(withCharacter, catalog, "char-1", 1, 1);
    expect(moved.characters?.[0]).toMatchObject({ col: 1, row: 1 });
  });
});
