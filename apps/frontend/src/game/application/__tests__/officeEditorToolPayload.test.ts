import { describe, expect, test } from "vitest";
import { buildOfficeEditorToolPayload } from "../officeEditorToolPayload";

describe("buildOfficeEditorToolPayload", () => {
  test("maps floor state into the editor payload", () => {
    expect(
      buildOfficeEditorToolPayload({
        activeTool: "floor",
        activeFloorMode: "pick",
        activeTileColor: "blue",
        activeFloorColor: { h: 214, s: 30, b: -100, c: -55 },
        activeFloorPattern: "environment.floors.pattern-03",
        activeFurnitureId: null,
      }),
    ).toEqual({
      tool: "floor",
      floorMode: "pick",
      tileColor: "blue",
      floorColor: { h: 214, s: 30, b: -100, c: -55 },
      floorPattern: "environment.floors.pattern-03",
    });
  });

  test("maps furniture state into the editor payload", () => {
    expect(
      buildOfficeEditorToolPayload({
        activeTool: "furniture",
        activeFloorMode: "paint",
        activeTileColor: null,
        activeFloorColor: { h: 35, s: 30, b: 15, c: 0 },
        activeFloorPattern: null,
        activeFurnitureId: "desk-01",
      }),
    ).toEqual({
      tool: "furniture",
      furnitureId: "desk-01",
    });
  });
});