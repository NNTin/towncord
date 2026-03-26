import { describe, expect, test, vi } from "vitest";
import type { OfficeSceneLayout, OfficeSceneTile } from "../../office/bootstrap";
import type { AnchoredGridRegion } from "../../../../engine/world-runtime/regions/anchoredGridRegion";
import { WorldSceneOfficeEditorController } from "../worldSceneOfficeEditorController";

function createControllerHarness() {
  const highlight = {
    setPosition: vi.fn(),
    setVisible: vi.fn(),
  };
  const emitOfficeFloorPicked = vi.fn();
  const pointer = {
    isDown: true,
    withinGame: true,
    x: 12,
    y: 12,
  };
  const tiles: OfficeSceneTile[] = [
    {
      kind: "floor",
      tileId: 0,
    },
  ];
  const layout: OfficeSceneLayout = {
    cols: 1,
    rows: 1,
    cellSize: 16,
    tiles,
    furniture: [],
    characters: [],
  };
  const region: AnchoredGridRegion<OfficeSceneLayout> = {
    anchorX16: 0,
    anchorY16: 0,
    layout,
  };
  const controller = new WorldSceneOfficeEditorController({
    getOfficeRegion: () => region,
    getOfficeCellHighlight: () => highlight as never,
    getActivePointer: () => pointer as never,
    getWorldPoint: (screenX, screenY) => ({ x: screenX, y: screenY }),
    emitOfficeFloorPicked,
  });

  return {
    controller,
    emitOfficeFloorPicked,
    highlight,
    pointer,
    region,
  };
}

describe("WorldSceneOfficeEditorController", () => {
  test("syncs the office highlight when a tool is selected", () => {
    const { controller, highlight } = createControllerHarness();

    controller.setOfficeEditorTool({ tool: "wall" });

    expect(highlight.setPosition).toHaveBeenCalledWith(0, 0);
    expect(highlight.setVisible).toHaveBeenCalledWith(true);
  });

  test("marks pending layout changes once after a successful office edit", () => {
    const { controller, region } = createControllerHarness();

    controller.setOfficeEditorTool({ tool: "wall" });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 12,
        y: 12,
      } as never),
    ).toBe(true);
    expect(region.layout.tiles[0]!.kind).toBe("wall");
    expect(controller.consumePendingLayoutChange()).toBe(true);
    expect(controller.consumePendingLayoutChange()).toBe(false);
  });

  test("pick mode emits the selected floor settings and switches back to paint mode", () => {
    const { controller, emitOfficeFloorPicked } = createControllerHarness();

    controller.setOfficeEditorTool({
      tool: "floor",
      floorMode: "pick",
      tileColor: null,
      floorColor: { h: 35, s: 30, b: 15, c: 0 },
      floorPattern: "environment.floors.pattern-01",
    });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 12,
        y: 12,
      } as never),
    ).toBe(true);
    expect(emitOfficeFloorPicked).toHaveBeenCalledWith({
      floorColor: null,
      floorPattern: "environment.floors.pattern-01",
    });
    expect(controller.getOfficeFloorMode()).toBe("paint");
    expect(controller.consumePendingLayoutChange()).toBe(false);
  });
});
