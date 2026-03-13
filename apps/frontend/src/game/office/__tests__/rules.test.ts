import { describe, expect, test } from "vitest";
import {
  buildOfficeCatalog,
  canPlaceOfficeCharacter,
  canPlaceOfficeFurniture,
  createEmptyOfficeLayout,
  createOfficeCharacter,
  expandOfficeLayout,
  getWallPlacementRow,
  moveOfficeCharacter,
  moveOfficeFurniture,
  OFFICE_TILE_TYPE,
  paintOfficeTile,
  placeOfficeCharacter,
  placeOfficeFurniture,
  rotateOfficeFurniture,
  toggleOfficeFurnitureState,
  type OfficeFurnitureAsset,
  type OfficePlacedFurniture,
} from "../index";

const ASSETS: OfficeFurnitureAsset[] = [
  {
    id: "DESK_FRONT",
    name: "desk-front",
    label: "Desk - Front",
    category: "desks",
    file: "desk-front.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
    groupId: "DESK",
    orientation: "front",
  },
  {
    id: "DESK_RIGHT",
    name: "desk-right",
    label: "Desk - Right",
    category: "desks",
    file: "desk-right.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
    groupId: "DESK",
    orientation: "right",
  },
  {
    id: "LAPTOP_OFF",
    name: "laptop-off",
    label: "Laptop - Off",
    category: "electronics",
    file: "laptop-off.png",
    width: 16,
    height: 16,
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: true,
    groupId: "LAPTOP",
    orientation: "front",
    state: "off",
  },
  {
    id: "LAPTOP_ON",
    name: "laptop-on",
    label: "Laptop - On",
    category: "electronics",
    file: "laptop-on.png",
    width: 16,
    height: 16,
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    canPlaceOnSurfaces: true,
    groupId: "LAPTOP",
    orientation: "front",
    state: "on",
  },
  {
    id: "POSTER",
    name: "poster",
    label: "Poster",
    category: "wall",
    file: "poster.png",
    width: 16,
    height: 32,
    footprintW: 1,
    footprintH: 2,
    isDesk: false,
    canPlaceOnWalls: true,
  },
  {
    id: "PLANT_TALL",
    name: "plant-tall",
    label: "Plant Tall",
    category: "decor",
    file: "plant-tall.png",
    width: 16,
    height: 32,
    footprintW: 1,
    footprintH: 2,
    isDesk: false,
    backgroundTiles: 1,
  },
];

const catalog = buildOfficeCatalog(ASSETS);

function withFloorRoom() {
  let layout = createEmptyOfficeLayout(4, 4);
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      layout = paintOfficeTile(layout, col, row, OFFICE_TILE_TYPE.FLOOR_1);
    }
  }
  return layout;
}

describe("office rules", () => {
  test("places surface items on desks but not on empty floor", () => {
    const desk: OfficePlacedFurniture = { uid: "desk-1", type: "DESK_FRONT", col: 1, row: 1 };
    const layout = placeOfficeFurniture(withFloorRoom(), catalog, desk);

    expect(canPlaceOfficeFurniture(layout, catalog, "LAPTOP_OFF", 1, 1)).toBe(true);
    expect(canPlaceOfficeFurniture(layout, catalog, "LAPTOP_OFF", 0, 0)).toBe(false);
  });

  test("allows background rows to overlap but blocks solid footprint rows", () => {
    const layout = placeOfficeFurniture(
      withFloorRoom(),
      catalog,
      { uid: "plant-a", type: "PLANT_TALL", col: 1, row: 1 },
    );

    expect(canPlaceOfficeFurniture(layout, catalog, "PLANT_TALL", 1, 0)).toBe(true);
    expect(canPlaceOfficeFurniture(layout, catalog, "PLANT_TALL", 1, 1)).toBe(false);
  });

  test("supports wall placement by aligning the bottom row to walls", () => {
    let layout = withFloorRoom();
    layout = paintOfficeTile(layout, 2, 3, OFFICE_TILE_TYPE.WALL);

    const row = getWallPlacementRow(catalog, "POSTER", 3);
    expect(row).toBe(2);
    expect(canPlaceOfficeFurniture(layout, catalog, "POSTER", 2, row)).toBe(true);
  });

  test("rotates and toggles furniture through catalog-defined variants", () => {
    let layout = placeOfficeFurniture(
      withFloorRoom(),
      catalog,
      { uid: "desk-1", type: "DESK_FRONT", col: 1, row: 1 },
    );
    layout = rotateOfficeFurniture(layout, catalog, "desk-1", "cw");

    expect(layout.furniture.find((item) => item.uid === "desk-1")?.type).toBe("DESK_RIGHT");

    layout = placeOfficeFurniture(
      layout,
      catalog,
      { uid: "laptop-1", type: "LAPTOP_OFF", col: 1, row: 1 },
    );

    layout = toggleOfficeFurnitureState(layout, catalog, "laptop-1");

    expect(layout.furniture.find((item) => item.uid === "laptop-1")?.type).toBe("LAPTOP_ON");
  });

  test("blocks characters on walls, void tiles, furniture, and other characters", () => {
    let layout = withFloorRoom();
    layout = paintOfficeTile(layout, 0, 0, OFFICE_TILE_TYPE.WALL);
    layout = placeOfficeFurniture(
      layout,
      catalog,
      { uid: "desk-1", type: "DESK_FRONT", col: 1, row: 1 },
    );
    layout = placeOfficeCharacter(layout, catalog, createOfficeCharacter("char-1", 0, 1));

    expect(canPlaceOfficeCharacter(layout, catalog, 0, 0)).toBe(false);
    expect(canPlaceOfficeCharacter(layout, catalog, 1, 1)).toBe(false);
    expect(canPlaceOfficeCharacter(layout, catalog, 0, 1)).toBe(false);
    expect(canPlaceOfficeCharacter(layout, catalog, 3, 3)).toBe(true);
  });

  test("moves furniture and characters when the layout expands left or up", () => {
    let layout = withFloorRoom();
    layout = placeOfficeFurniture(
      layout,
      catalog,
      { uid: "desk-1", type: "DESK_FRONT", col: 1, row: 1 },
    );
    layout = placeOfficeCharacter(layout, catalog, createOfficeCharacter("char-1", 3, 3));

    const expanded = expandOfficeLayout(layout, "left");
    const shifted = expandOfficeLayout(expanded.layout, "up");

    expect(shifted.layout.furniture.find((item) => item.uid === "desk-1")).toMatchObject({
      col: 2,
      row: 2,
    });
    expect(shifted.layout.characters?.find((item) => item.uid === "char-1")).toMatchObject({
      col: 4,
      row: 4,
    });
    expect(shifted.shift).toEqual({ col: 0, row: 1 });
  });

  test("moves characters and furniture only when the destination remains valid", () => {
    let layout = withFloorRoom();
    layout = placeOfficeFurniture(
      layout,
      catalog,
      { uid: "desk-1", type: "DESK_FRONT", col: 1, row: 1 },
    );
    layout = placeOfficeCharacter(layout, catalog, createOfficeCharacter("char-1", 0, 0));

    expect(moveOfficeFurniture(layout, catalog, "desk-1", 3, 3)).toBe(layout);

    const movedCharacter = moveOfficeCharacter(layout, catalog, "char-1", 3, 3);
    expect(movedCharacter.characters?.find((item) => item.uid === "char-1")).toMatchObject({
      col: 3,
      row: 3,
    });
  });
});
