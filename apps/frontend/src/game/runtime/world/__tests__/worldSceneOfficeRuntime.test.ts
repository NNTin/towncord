import { describe, expect, test, vi } from "vitest";
import type { OfficeSceneBootstrap } from "../../../contracts/office-scene";
import {
  FURNITURE_ALL_ITEMS,
  resolveFurnitureRotationVariant,
} from "../../../content/structures/furniturePalette";
import { RUNTIME_TO_UI_EVENTS } from "../../transport/runtimeEvents";
import { WorldSceneOfficeRuntime } from "../worldSceneOfficeRuntime";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

const laptop = (() => {
  const item = FURNITURE_ALL_ITEMS.find(
    (candidate) =>
      candidate.groupId === "LAPTOP" &&
      candidate.orientation === "front" &&
      candidate.state === "off",
  );
  if (!item) {
    throw new Error("Missing laptop test asset");
  }

  return item;
})();

const rotatingChair = (() => {
  const item = FURNITURE_ALL_ITEMS.find(
    (candidate) =>
      candidate.groupId === "ROTATING_CHAIR" &&
      candidate.orientation === "front",
  );
  if (!item) {
    throw new Error("Missing rotating chair test asset");
  }

  return item;
})();

const officeRenderMocks = vi.hoisted(() => ({
  renderOfficeLayout: vi.fn(() => ({
    destroy: vi.fn(),
    partialUpdate: vi.fn(),
    renderIndex: {
      furniture: [
        {
          id: "desk-laptop",
          bounds: {
            contains(x: number, y: number) {
              return x >= 32 && y >= 48 && x < 48 && y < 64;
            },
            x: 32,
            y: 48,
            width: 16,
            height: 16,
          },
        },
      ],
      characters: [],
    },
  })),
}));

vi.mock("../../../../engine", () => ({
  renderOfficeLayout: officeRenderMocks.renderOfficeLayout,
  WORLD_REGION_BASE_PX: 16,
  anchoredGridCellToWorldPixel: (col: number, row: number, region: { anchorX16: number; anchorY16: number; layout: { cellSize: number } }) => ({
    worldX: region.anchorX16 * 16 + col * region.layout.cellSize,
    worldY: region.anchorY16 * 16 + row * region.layout.cellSize,
  }),
}));

function createBootstrap(): OfficeSceneBootstrap {
  return {
    anchor: {
      x: 2,
      y: 3,
    },
    layout: {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [
        {
          kind: "void" as const,
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
    },
  };
}

function createHarness() {
  const emit = vi.fn();
  const cellHighlight = {
    destroy: vi.fn(),
    setDepth: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
    setSize: vi.fn(),
  };
  const selectionHighlight = {
    destroy: vi.fn(),
    setDepth: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
    setSize: vi.fn(),
  };
  const previewCell = {
    destroy: vi.fn(),
    setDepth: vi.fn(),
    setFillStyle: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setSize: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
  };
  const previewGhost = {
    destroy: vi.fn(),
    setAlpha: vi.fn(),
    setDepth: vi.fn(),
    setDisplaySize: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setTexture: vi.fn(),
    setVisible: vi.fn(),
  };
  const previewLabel = {
    destroy: vi.fn(),
    setDepth: vi.fn(),
    setPosition: vi.fn(),
    setText: vi.fn(),
    setVisible: vi.fn(),
  };
  const scene = {
    add: {
      rectangle: vi.fn()
        .mockImplementationOnce(() => cellHighlight)
        .mockImplementationOnce(() => selectionHighlight)
        .mockImplementation(() => previewCell),
      image: vi.fn(() => previewGhost),
      text: vi.fn(() => previewLabel),
    },
    cameras: {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    },
    input: {
      activePointer: {
        withinGame: true,
        x: 20,
        y: 20,
      },
    },
  };
  const runtime = new WorldSceneOfficeRuntime(
    {
      scene: scene as never,
      getActivePointer: () => scene.input.activePointer as never,
      getWorldPoint: (screenX, screenY) => ({
        x: screenX,
        y: screenY,
      }),
    },
    new WorldSceneProjectionEmitter({
      getRuntimeHost: () => ({
        events: {
          emit,
          on: vi.fn(),
          off: vi.fn(),
        },
      }),
    }),
  );

  return {
    emit,
    cellHighlight,
    previewCell,
    previewGhost,
    previewLabel,
    selectionHighlight,
    runtime,
    scene,
  };
}

describe("WorldSceneOfficeRuntime", () => {
  test("bootstraps the office renderable and highlight overlay", () => {
    const { cellHighlight, runtime, scene, selectionHighlight } = createHarness();
    const bootstrap = createBootstrap();

    runtime.bootstrap(bootstrap);

    expect(officeRenderMocks.renderOfficeLayout).toHaveBeenCalledOnce();
    expect(officeRenderMocks.renderOfficeLayout).toHaveBeenCalledWith(
      scene,
      bootstrap.layout,
      expect.objectContaining({
        worldOffsetX: 32,
        worldOffsetY: 48,
        depthAnchorRow: 3,
      }),
    );
    expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
    expect(cellHighlight.setOrigin).toHaveBeenCalledWith(0, 0);
    expect(selectionHighlight.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  test("selects, rotates, and deletes furniture through the runtime facade", () => {
    const { emit, runtime } = createHarness();
    const bootstrap = createBootstrap();

    runtime.bootstrap(bootstrap);
    runtime.handleSetEditorTool({ tool: null });

    expect(
      runtime.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 36,
        y: 52,
      } as never),
    ).toBe(true);
    expect(runtime.getSelectedFurnitureId()).toBe("desk-laptop");
    expect(
      runtime.rotateSelectedFurniture(),
    ).toBe(true);
    expect(bootstrap.layout.furniture[0]?.assetId).not.toBe(laptop.id);

    expect(runtime.deleteSelectedFurniture()).toBe(true);
    expect(bootstrap.layout.furniture).toHaveLength(0);
    expect(emit).toHaveBeenCalledWith(
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      expect.objectContaining({
        layout: expect.objectContaining({
          furniture: [],
        }),
      }),
    );
  });

  test("right-click wall deletion removes walls without requiring a paint drag", () => {
    const { runtime } = createHarness();
    const bootstrap = createBootstrap();
    bootstrap.layout.tiles[0] = {
      kind: "wall",
      tileId: 8,
    };

    runtime.bootstrap(bootstrap);
    runtime.handleSetEditorTool({ tool: "wall" });

    expect(
      runtime.tryHandleSecondaryPointerDown({
        button: 2,
        isDown: true,
        x: 36,
        y: 52,
      } as never),
    ).toBe(true);
    runtime.update();
    expect(bootstrap.layout.tiles[0]?.kind).toBe("void");
  });

  test("renders the hovered furniture preview inside the office scene", () => {
    const { previewCell, previewGhost, previewLabel, runtime, scene } = createHarness();
    const bootstrap = createBootstrap();
    const rotatedChair = resolveFurnitureRotationVariant(rotatingChair.id, 1);
    if (!rotatedChair) {
      throw new Error("Missing rotated chair test asset");
    }

    scene.input.activePointer = {
      withinGame: true,
      x: 36,
      y: 52,
    };

    runtime.bootstrap(bootstrap);
    runtime.handleSetEditorTool({
      tool: "furniture",
      furnitureId: rotatingChair.id,
      rotationQuarterTurns: 1,
    });

    expect(previewGhost.setTexture).toHaveBeenCalledWith(
      "donarg.office.furniture",
      rotatedChair.atlasKey,
    );
    expect(previewGhost.setPosition).toHaveBeenCalledWith(32, 48);
    expect(previewGhost.setDisplaySize).toHaveBeenCalledWith(16, 16);
    expect(previewCell.setPosition).toHaveBeenCalledWith(32, 48);
    expect(previewLabel.setText).toHaveBeenCalledWith("Replace Laptop - Front - Off");
  });

  test("rerenders and emits layout projections after office edits", () => {
    const { emit, runtime } = createHarness();
    const bootstrap = createBootstrap();

    runtime.bootstrap(bootstrap);
    runtime.handleSetEditorTool({
      tool: "wall",
    });

    expect(
      runtime.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 40,
        y: 50,
      } as never),
    ).toBe(true);

    runtime.update();

    const renderResults = officeRenderMocks.renderOfficeLayout.mock.results;
    const renderable =
      renderResults[renderResults.length - 1]?.value;
    expect(renderable?.partialUpdate).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      expect.objectContaining({
        layout: expect.objectContaining({
          tiles: [expect.objectContaining({ kind: "wall" })],
        }),
      }),
    );
  });
});
