import { describe, expect, test } from "vitest";
import {
  buildOfficeCatalog,
  getOfficeFurnitureEntry,
  getRotatedOfficeFurnitureType,
  getToggledOfficeFurnitureType,
  listVisibleOfficeFurnitureTypes,
  type OfficeFurnitureAsset,
} from "../index";

const ASSETS: OfficeFurnitureAsset[] = [
  {
    id: "DESK_FRONT_OFF",
    name: "desk-front-off",
    label: "Desk - Front - Off",
    category: "desks",
    file: "desk-front-off.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
    groupId: "DESK",
    orientation: "front",
    state: "off",
  },
  {
    id: "DESK_RIGHT_OFF",
    name: "desk-right-off",
    label: "Desk - Right - Off",
    category: "desks",
    file: "desk-right-off.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
    groupId: "DESK",
    orientation: "right",
    state: "off",
  },
  {
    id: "DESK_FRONT_ON",
    name: "desk-front-on",
    label: "Desk - Front - On",
    category: "desks",
    file: "desk-front-on.png",
    width: 32,
    height: 32,
    footprintW: 2,
    footprintH: 2,
    isDesk: true,
    groupId: "DESK",
    orientation: "front",
    state: "on",
  },
  {
    id: "LAPTOP_FRONT_OFF",
    name: "laptop-front-off",
    label: "Laptop - Front - Off",
    category: "electronics",
    file: "laptop-front-off.png",
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
    id: "LAPTOP_FRONT_ON",
    name: "laptop-front-on",
    label: "Laptop - Front - On",
    category: "electronics",
    file: "laptop-front-on.png",
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
];

describe("buildOfficeCatalog", () => {
  test("hides non-front rotations and on-state variants from the visible palette", () => {
    const catalog = buildOfficeCatalog(ASSETS);

    expect(listVisibleOfficeFurnitureTypes(catalog, "desks")).toEqual(["DESK_FRONT_OFF"]);
    expect(listVisibleOfficeFurnitureTypes(catalog, "electronics")).toEqual(["LAPTOP_FRONT_OFF"]);
    expect(listVisibleOfficeFurnitureTypes(catalog, "wall")).toEqual(["POSTER"]);

    expect(getOfficeFurnitureEntry(catalog, "DESK_RIGHT_OFF")?.orientation).toBe("right");
    expect(getRotatedOfficeFurnitureType(catalog, "DESK_FRONT_OFF", "cw")).toBe("DESK_RIGHT_OFF");
    expect(getToggledOfficeFurnitureType(catalog, "LAPTOP_FRONT_OFF")).toBe("LAPTOP_FRONT_ON");
  });
});

