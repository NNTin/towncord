import { describe, expect, test } from "vitest";
import { createOfficeToolStateData, reduceOfficeToolState } from "../officeToolState";

describe("office tool state reducer", () => {
  test("turning layout mode off clears the active tool and resets floor mode", () => {
    const next = reduceOfficeToolState(
      {
        ...createOfficeToolStateData(),
        isLayoutPaintMode: true,
        activeTool: "floor",
        activeFloorMode: "pick",
      },
      { type: "toggleLayoutMode" },
    );

    expect(next.isLayoutPaintMode).toBe(false);
    expect(next.activeTool).toBeNull();
    expect(next.activeFloorMode).toBe("paint");
  });

  test("selecting a non-floor tool resets the floor sub-mode synchronously", () => {
    const next = reduceOfficeToolState(
      {
        ...createOfficeToolStateData(),
        isLayoutPaintMode: true,
        activeTool: "floor",
        activeFloorMode: "pick",
      },
      { type: "selectTool", tool: "wall" },
    );

    expect(next.activeTool).toBe("wall");
    expect(next.activeFloorMode).toBe("paint");
  });

  test("floor picks keep the paint tool active and synchronize floor color state", () => {
    const next = reduceOfficeToolState(createOfficeToolStateData(), {
      type: "officeFloorPicked",
      payload: {
        floorColor: { h: 214, s: 30, b: -100, c: -55 },
        floorPattern: "environment.floors.pattern-03",
      },
    });

    expect(next.activeTool).toBe("floor");
    expect(next.activeFloorMode).toBe("paint");
    expect(next.activeFloorPattern).toBe("environment.floors.pattern-03");
    expect(next.activeFloorColor).toEqual({ h: 214, s: 30, b: -100, c: -55 });
    expect(next.activeFloorColor).not.toBe(createOfficeToolStateData().activeFloorColor);
    expect(next.activeTileColor).toBeNull();
  });

  test("stores wall color edits as cloned state", () => {
    const wallColor = { h: 214, s: 25, b: -54, c: 17 };
    const next = reduceOfficeToolState(createOfficeToolStateData(), {
      type: "selectWallColor",
      color: wallColor,
    });

    expect(next.activeWallColor).toEqual(wallColor);
    expect(next.activeWallColor).not.toBe(wallColor);
  });

  test("selecting a different furniture asset resets the pending rotation", () => {
    const next = reduceOfficeToolState(
      {
        ...createOfficeToolStateData(),
        activeFurnitureId: "ASSET_107",
        activeFurnitureRotationQuarterTurns: 3,
      },
      { type: "selectFurnitureId", id: "ASSET_78" },
    );

    expect(next.activeFurnitureId).toBe("ASSET_78");
    expect(next.activeFurnitureRotationQuarterTurns).toBe(0);
  });

  test("rotates the pending furniture preview clockwise in quarter turns", () => {
    const once = reduceOfficeToolState(createOfficeToolStateData(), {
      type: "rotateFurnitureClockwise",
    });
    const wrapped = reduceOfficeToolState(
      {
        ...createOfficeToolStateData(),
        activeFurnitureRotationQuarterTurns: 3,
      },
      { type: "rotateFurnitureClockwise" },
    );

    expect(once.activeFurnitureRotationQuarterTurns).toBe(1);
    expect(wrapped.activeFurnitureRotationQuarterTurns).toBe(0);
  });
});
