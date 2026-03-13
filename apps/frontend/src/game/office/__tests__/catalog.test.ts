import { describe, expect, test } from "vitest";
import {
  buildOfficeFurnitureCatalogIndex,
  getRotatedFurnitureType,
  getToggledFurnitureType,
  getVisibleFurnitureTypesForCategory,
} from "../catalog";
import type { OfficeFurnitureCatalogAsset } from "../model";

const ASSETS: OfficeFurnitureCatalogAsset[] = [
  {
    id: "DESK_FRONT_OFF",
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
    id: "BOOKSHELF",
    label: "Bookshelf",
    category: "storage",
    file: "bookshelf.png",
    width: 16,
    height: 32,
    footprintW: 1,
    footprintH: 2,
    isDesk: false,
  },
];

describe("office catalog", () => {
  test("builds visible catalog entries while hiding alternate orientations and on-state variants", () => {
    const index = buildOfficeFurnitureCatalogIndex(ASSETS);

    expect(getVisibleFurnitureTypesForCategory(index, "desks")).toEqual(["DESK_FRONT_OFF"]);
    expect(getVisibleFurnitureTypesForCategory(index, "storage")).toEqual(["BOOKSHELF"]);
  });

  test("builds rotation and toggle lookup groups", () => {
    const index = buildOfficeFurnitureCatalogIndex(ASSETS);

    expect(getRotatedFurnitureType(index, "DESK_FRONT_OFF", "cw")).toBe("DESK_RIGHT_OFF");
    expect(getRotatedFurnitureType(index, "DESK_RIGHT_OFF", "ccw")).toBe("DESK_FRONT_OFF");
    expect(getToggledFurnitureType(index, "DESK_FRONT_OFF")).toBe("DESK_FRONT_ON");
    expect(getToggledFurnitureType(index, "DESK_FRONT_ON")).toBe("DESK_FRONT_OFF");
  });
});
