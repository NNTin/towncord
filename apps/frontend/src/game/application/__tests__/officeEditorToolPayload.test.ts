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
        activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
        activeFurnitureId: null,
        activeFurnitureRotationQuarterTurns: 0,
        activePropId: null,
        activePropRotationQuarterTurns: 0,
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
        activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
        activeFurnitureId: "desk-01",
        activeFurnitureRotationQuarterTurns: 2,
        activePropId: null,
        activePropRotationQuarterTurns: 0,
      }),
    ).toEqual({
      tool: "furniture",
      furnitureId: "desk-01",
      rotationQuarterTurns: 2,
    });
  });

  test("maps wall state into the editor payload", () => {
    expect(
      buildOfficeEditorToolPayload({
        activeTool: "wall",
        activeFloorMode: "paint",
        activeTileColor: null,
        activeFloorColor: { h: 35, s: 30, b: 15, c: 0 },
        activeFloorPattern: null,
        activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
        activeFurnitureId: null,
        activeFurnitureRotationQuarterTurns: 0,
        activePropId: null,
        activePropRotationQuarterTurns: 0,
      }),
    ).toEqual({
      tool: "wall",
      wallColor: { h: 214, s: 25, b: -54, c: 17 },
    });
  });

  test("maps prop state into the editor payload", () => {
    expect(
      buildOfficeEditorToolPayload({
        activeTool: "prop",
        activeFloorMode: "paint",
        activeTileColor: null,
        activeFloorColor: { h: 35, s: 30, b: 15, c: 0 },
        activeFloorPattern: null,
        activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
        activeFurnitureId: null,
        activeFurnitureRotationQuarterTurns: 0,
        activePropId: "prop.static.set-01.variant-01",
        activePropRotationQuarterTurns: 2,
      }),
    ).toEqual({
      tool: "prop",
      propId: "prop.static.set-01.variant-01",
      rotationQuarterTurns: 2,
    });
  });
});
