import { describe, expect, test, vi } from "vitest";
import type {
  OfficeSceneLayout,
  OfficeSceneTile,
} from "../../office/bootstrap";
import type { AnchoredGridRegion } from "../../../../engine/world-runtime/regions/anchoredGridRegion";
import { FURNITURE_ALL_ITEMS } from "../../../content/structures/furniturePalette";
import { resolvePropPaletteItem } from "../../../content/structures/propPalette";
import { WorldSceneOfficeEditorController } from "../worldSceneOfficeEditorController";

function createControllerHarness(
  options: { cols?: number; rows?: number } = {},
) {
  const cols = options.cols ?? 1;
  const rows = options.rows ?? 1;
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
  const tiles: OfficeSceneTile[] = Array.from({ length: cols * rows }, () => ({
    kind: "floor",
    tileId: 0,
  }));
  const layout: OfficeSceneLayout = {
    cols,
    rows,
    cellSize: 16,
    tiles,
    furniture: [],
    characters: [],
  };
  const laptop = FURNITURE_ALL_ITEMS.find(
    (item) =>
      item.groupId === "LAPTOP" &&
      item.orientation === "front" &&
      item.state === "off",
  );
  if (!laptop) {
    throw new Error("Missing laptop test asset");
  }
  layout.furniture = [
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
  ];
  const region: AnchoredGridRegion<OfficeSceneLayout> = {
    anchorX16: 0,
    anchorY16: 0,
    layout,
  };
  const controller = new WorldSceneOfficeEditorController({
    getOfficeRegion: () => region,
    getOfficeCellHighlight: () => highlight as never,
    getOfficeFurnitureTargets: () => [
      {
        id: "desk-laptop",
        bounds: {
          contains(x: number, y: number) {
            return x >= 0 && y >= 0 && x < 16 && y < 16;
          },
        } as never,
      },
    ],
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

    controller.setOfficeEditorTool({
      tool: "wall",
      wallColor: { h: 214, s: 25, b: -54, c: 17 },
    });

    expect(highlight.setPosition).toHaveBeenCalledWith(0, 0);
    expect(highlight.setVisible).toHaveBeenCalledWith(true);
  });

  test("marks pending layout changes once after a successful office edit", () => {
    const { controller, region } = createControllerHarness();

    controller.setOfficeEditorTool({
      tool: "wall",
      wallColor: { h: 214, s: 25, b: -54, c: 17 },
    });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 12,
        y: 12,
      } as never),
    ).toBe(true);
    expect(region.layout.tiles[0]!.kind).toBe("wall");
    expect(region.layout.tiles[0]!.tileId).toBe(8);
    expect(region.layout.tiles[0]!.colorAdjust).toEqual({
      h: 214,
      s: 25,
      b: -54,
      c: 17,
    });
    expect(region.layout.tiles[0]!.tint).toBe(0x334155);
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

  test("selects furniture on idle layout clicks and can rotate or delete the selected placeable", () => {
    const { controller, region } = createControllerHarness();

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);
    expect(controller.getSelectedFurnitureId()).toBe("desk-laptop");

    expect(controller.rotateSelectedFurniture()).toBe(true);
    expect(region.layout.furniture[0]?.assetId).not.toBe("ASSET_107");

    expect(controller.deleteSelectedFurniture()).toBe(true);
    expect(region.layout.furniture).toHaveLength(0);
    expect(controller.getSelectedFurnitureId()).toBeNull();
  });

  test("projects the hovered furniture placement preview from the active tool", () => {
    const { controller } = createControllerHarness({ cols: 3, rows: 2 });
    const chair = FURNITURE_ALL_ITEMS.find(
      (item) =>
        item.groupId === "ROTATING_CHAIR" && item.orientation === "front",
    );
    if (!chair) {
      throw new Error("Missing rotating chair test asset");
    }

    controller.setOfficeEditorTool({
      tool: "furniture",
      furnitureId: chair.id,
      rotationQuarterTurns: 0,
    });

    expect(
      controller.getFurniturePlacementPreview({
        isDown: false,
        withinGame: true,
        x: 4,
        y: 4,
      } as never),
    ).toMatchObject({
      kind: "replace",
      anchorCell: { col: 0, row: 0 },
      affectedFurniture: [expect.objectContaining({ id: "desk-laptop" })],
      blockedReason: null,
    });
  });

  test("projects a place preview when a different furniture category overlaps", () => {
    const { controller } = createControllerHarness({ cols: 3, rows: 2 });
    const decor = FURNITURE_ALL_ITEMS.find(
      (item) => item.category === "decor" && item.placement === "floor",
    );
    if (!decor) {
      throw new Error("Missing floor decor test asset");
    }

    controller.setOfficeEditorTool({
      tool: "furniture",
      furnitureId: decor.id,
      rotationQuarterTurns: 0,
    });

    expect(
      controller.getFurniturePlacementPreview({
        isDown: false,
        withinGame: true,
        x: 4,
        y: 4,
      } as never),
    ).toMatchObject({
      kind: "place",
      affectedFurniture: [],
      blockedReason: null,
    });
  });

  test("does not project or place props through the office editor tool", () => {
    const { controller, region } = createControllerHarness({
      cols: 3,
      rows: 3,
    });
    const prop = resolvePropPaletteItem("prop.static.set-01.variant-01");
    if (!prop) {
      throw new Error("Missing FarmRPG prop test asset");
    }

    controller.setOfficeEditorTool({
      tool: "prop",
      propId: prop.id,
      rotationQuarterTurns: 0,
    });

    expect(
      controller.getFurniturePlacementPreview({
        isDown: false,
        withinGame: true,
        x: 20,
        y: 20,
      } as never),
    ).toBeNull();

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 20,
        y: 20,
      } as never),
    ).toBe(false);

    expect(
      region.layout.furniture.some((item) => item.assetId === prop.id),
    ).toBe(false);
  });

  test("starts a furniture drag on second click of the selected item and hides same-cell move previews", () => {
    const { controller, region } = createControllerHarness();

    // First click: select the furniture
    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);
    expect(controller.getSelectedFurnitureId()).toBe("desk-laptop");
    expect(controller.isFurnitureDragging()).toBe(false);

    // Second click on the same furniture: start drag
    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);
    expect(controller.isFurnitureDragging()).toBe(true);

    // shouldContinuePainting returns true while dragging with pointer down
    expect(controller.shouldContinuePainting({ isDown: true } as never)).toBe(
      true,
    );

    // Same-cell drags should not show a preview because moveFurniture would be a no-op.
    const preview = controller.getDragMovePreview({
      isDown: true,
      withinGame: true,
      x: 4,
      y: 4,
    } as never);
    expect(preview).toBeNull();

    // end painting clears drag state without mutating the layout
    controller.endPainting();
    expect(controller.isFurnitureDragging()).toBe(false);
    expect(controller.consumePendingLayoutChange()).toBe(false);
    expect(region.layout.furniture[0]?.col).toBe(0);
    expect(region.layout.furniture[0]?.row).toBe(0);
  });

  test("cancels a furniture drag when the pointer leaves the playable office area", () => {
    const { controller, region } = createControllerHarness({
      cols: 3,
      rows: 2,
    });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);
    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);

    expect(
      controller.getDragMovePreview({
        isDown: true,
        withinGame: true,
        x: 20,
        y: 4,
      } as never),
    ).toMatchObject({
      kind: "place",
      anchorCell: { col: 1, row: 0 },
    });

    expect(
      controller.getDragMovePreview({
        isDown: true,
        withinGame: false,
        x: 20,
        y: 4,
      } as never),
    ).toBeNull();

    controller.endPainting();

    expect(region.layout.furniture[0]?.col).toBe(0);
    expect(region.layout.furniture[0]?.row).toBe(0);
    expect(controller.consumePendingLayoutChange()).toBe(false);
  });

  test("right-click wall deletion only removes wall tiles", () => {
    const { controller, region } = createControllerHarness();
    region.layout.tiles[0] = {
      kind: "wall",
      tileId: 8,
    };

    controller.setOfficeEditorTool({
      tool: "wall",
      wallColor: { h: 214, s: 25, b: -54, c: 17 },
    });

    expect(
      controller.tryHandleSecondaryPointerDown({
        button: 2,
        isDown: true,
        x: 4,
        y: 4,
      } as never),
    ).toBe(true);
    expect(region.layout.tiles[0]?.kind).toBe("void");
    expect(controller.consumePendingLayoutChange()).toBe(true);
  });
});
