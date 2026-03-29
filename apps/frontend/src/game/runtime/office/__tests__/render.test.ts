import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { renderOfficeLayout } from "../../../../engine/structures/renderOfficeLayout";
import type { OfficeSceneLayout } from "../bootstrap";

vi.mock("phaser", () => {
  class Rectangle {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number,
    ) {}
  }

  return {
    default: {
      Geom: {
        Rectangle,
      },
    },
  };
});

class FakeDisplayObject {
  public visible = true;
  public destroyed = false;
  public depth = 0;

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  setOrigin(_x: number, _y?: number): this {
    return this;
  }

  setAlpha(_alpha: number): this {
    return this;
  }

  setScale(_x: number, _y?: number): this {
    return this;
  }

  setStrokeStyle(_width: number, _color: number, _alpha?: number): this {
    return this;
  }

  setDisplaySize(_width: number, _height: number): this {
    return this;
  }

  setTint(_tint: number): this {
    return this;
  }

  clearTint(): this {
    return this;
  }

  setPosition(_x: number, _y: number): this {
    return this;
  }

  setTexture(_key: string, _frame?: string): this {
    return this;
  }

  setRotation(_rotation: number): this {
    return this;
  }

  setFlip(_x: boolean, _y: boolean): this {
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeGraphics extends FakeDisplayObject {
  fillStyle(_color: number, _alpha?: number): this {
    return this;
  }

  fillRect(_x: number, _y: number, _width: number, _height: number): this {
    return this;
  }

  lineStyle(_width: number, _color: number, _alpha?: number): this {
    return this;
  }

  strokeRect(_x: number, _y: number, _width: number, _height: number): this {
    return this;
  }
}

class FakeRenderTexture extends FakeDisplayObject {
  public width = 0;
  public height = 0;
  public batchDrawCalls = 0;

  constructor(width: number, height: number) {
    super();
    this.width = width;
    this.height = height;
  }

  beginDraw(): this {
    return this;
  }

  endDraw(): this {
    return this;
  }

  batchDraw(_source: unknown): this {
    this.batchDrawCalls += 1;
    return this;
  }

  draw(_source: unknown): this {
    return this;
  }

  clear(): this {
    return this;
  }
}

class FakeContainer extends FakeDisplayObject {
  public readonly children: unknown[] = [];

  add(child: unknown | unknown[]): this {
    if (Array.isArray(child)) {
      this.children.push(...child);
    } else {
      this.children.push(child);
    }
    return this;
  }

  remove(child: unknown, _destroy?: boolean): this {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    return this;
  }

  removeAll(destroy?: boolean): this {
    if (destroy) {
      for (const child of this.children) {
        (child as FakeDisplayObject).destroy();
      }
    }
    this.children.length = 0;
    return this;
  }

  override destroy(_fromScene?: boolean): void {
    super.destroy();
  }
}

function createScene() {
  const add = {
    container: vi.fn(() => new FakeContainer()),
    graphics: vi.fn(() => new FakeGraphics()),
    renderTexture: vi.fn(
      (_x: number, _y: number, width: number, height: number) =>
        new FakeRenderTexture(width, height),
    ),
    image: vi.fn(
      (_x: number, _y: number, _key: string, _frame?: string) =>
        new FakeDisplayObject(),
    ),
    ellipse: vi.fn(() => new FakeDisplayObject()),
    circle: vi.fn(() => new FakeDisplayObject()),
    rectangle: vi.fn(() => new FakeDisplayObject()),
    text: vi.fn(() => new FakeDisplayObject()),
  };

  const make = {
    image: vi.fn(() => new FakeDisplayObject()),
  };

  return { add, make };
}

function createLayout(
  characters: OfficeSceneLayout["characters"],
): OfficeSceneLayout {
  return {
    cols: 2,
    rows: 2,
    cellSize: 16,
    tiles: [
      {
        kind: "floor",
        tileId: 0,
        tint: 0x475569,
        pattern: "environment.floors.pattern-01",
      },
      { kind: "void", tileId: 0 },
      { kind: "void", tileId: 0 },
      { kind: "wall", tileId: 8 },
    ],
    furniture: [],
    characters,
  };
}

function createFurnitureItem(
  overrides: Partial<OfficeSceneLayout["furniture"][number]> = {},
) {
  return {
    id: "desk-1",
    assetId: "asset-front",
    label: "Desk Front",
    category: "desk" as never,
    placement: "floor" as const,
    col: 0,
    row: 0,
    width: 1,
    height: 1,
    color: 0x334155,
    accentColor: 0x94a3b8,
    renderAsset: {
      atlasKey: "asset-front",
      atlasFrame: { x: 0, y: 0, w: 16, h: 16 },
    },
    ...overrides,
  };
}

/** Returns only the image call results whose frame arg starts with "environment.walls.". */
function findWallImages(
  scene: ReturnType<typeof createScene>,
): FakeDisplayObject[] {
  const results: FakeDisplayObject[] = [];
  for (let i = 0; i < scene.add.image.mock.calls.length; i++) {
    const args = scene.add.image.mock.calls[i];
    const result = scene.add.image.mock.results[i];
    if (!args || !result) continue;
    const frame = args[3];
    if (typeof frame === "string" && frame.startsWith("environment.walls.")) {
      results.push(result.value as FakeDisplayObject);
    }
  }
  return results;
}

describe("renderOfficeLayout", () => {
  test("wall sprites are added as scene-level objects with y-sorted depth", () => {
    // Wall at col=0, row=1 in a 2×2 grid with cellSize=16 and worldOffsetY=32.
    // Expected depth = worldOffsetY + (row + 1) * cellSize = 32 + 2 * 16 = 64.
    const scene = createScene();
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: [
        { kind: "floor", tileId: 0 },
        { kind: "void", tileId: 0 },
        { kind: "wall", tileId: 8 },
        { kind: "floor", tileId: 0 },
      ],
      furniture: [],
      characters: [],
    };

    renderOfficeLayout(scene as unknown as Phaser.Scene, layout, {
      worldOffsetY: 32,
    });

    const wallImages = findWallImages(scene);
    expect(wallImages).toHaveLength(1);
    // The wall at row=1 must have depth 64 so it occludes entities above it.
    expect(wallImages[0]?.depth).toBe(64);
  });

  test("wall sprite depths update when partialUpdate changes the tile layout", () => {
    const scene = createScene();
    const wallTile = { kind: "wall" as const, tileId: 8 };
    const floorTile = { kind: "floor" as const, tileId: 0 };
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: [wallTile, floorTile],
      furniture: [],
      characters: [],
    };

    const renderable = renderOfficeLayout(
      scene as unknown as Phaser.Scene,
      layout,
      {
        worldOffsetY: 0,
      },
    );

    // Initial: one wall sprite at row=0 → depth = 0 + (0+1)*16 = 16.
    const initialWallImages = findWallImages(scene);
    expect(initialWallImages).toHaveLength(1);
    const initialWallSprite = initialWallImages[0]!;
    expect(initialWallSprite.depth).toBe(16);

    // Move the wall to row=1; the old row=0 sprite must be destroyed and a
    // new sprite at depth = (0+2)*16 = 32 must be created.
    renderable.partialUpdate({
      ...layout,
      tiles: [floorTile, wallTile],
    });

    expect(initialWallSprite.destroyed).toBe(true);

    const allWallImages = findWallImages(scene);
    // Two total wall image calls: the original (now destroyed) + the new one.
    expect(allWallImages).toHaveLength(2);
    const newWallSprite = allWallImages[1]!;
    expect(newWallSprite.depth).toBe(32);
    expect(newWallSprite.destroyed).toBe(false);
  });

  test("reuses the existing character render when the characters array is unchanged", () => {
    const scene = createScene();
    const characters = [
      {
        id: "char-1",
        label: "Ari",
        glyph: "@",
        col: 0,
        row: 0,
        color: 0x2563eb,
        accentColor: 0xbfdbfe,
      },
    ];
    const layout = createLayout(characters);

    const renderable = renderOfficeLayout(
      scene as unknown as Phaser.Scene,
      layout,
    );
    const initialContainerCalls = scene.add.container.mock.calls.length;

    renderable.partialUpdate({
      ...layout,
      tiles: layout.tiles,
      furniture: layout.furniture,
      characters,
    });

    expect(scene.add.container.mock.calls.length).toBe(initialContainerCalls);
    expect(renderable.renderIndex.characters).toHaveLength(1);
  });

  test("refreshes existing furniture renders when partialUpdate changes position or asset", () => {
    const scene = createScene();
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 1,
      cellSize: 16,
      tiles: [
        { kind: "floor", tileId: 0 },
        { kind: "floor", tileId: 0 },
      ],
      furniture: [createFurnitureItem()],
      characters: [],
    };

    const renderable = renderOfficeLayout(
      scene as unknown as Phaser.Scene,
      layout,
      {
        worldOffsetX: 32,
        worldOffsetY: 48,
      },
    );
    const initialFurnitureContainer = scene.add.container.mock.results[2]
      ?.value as FakeContainer;

    renderable.partialUpdate({
      ...layout,
      furniture: [
        createFurnitureItem({
          label: "Desk Right",
          assetId: "asset-right",
          col: 1,
          renderAsset: {
            atlasKey: "asset-right",
            atlasFrame: { x: 16, y: 0, w: 16, h: 16 },
          },
        }),
      ],
    });

    expect(initialFurnitureContainer.destroyed).toBe(true);
    expect(renderable.renderIndex.furniture[0]).toMatchObject({
      label: "Desk Right",
      bounds: expect.objectContaining({
        x: 48,
        y: 48,
        width: 16,
        height: 16,
      }),
    });
    expect(scene.add.container.mock.calls[3]).toEqual([48, 48]);
  });

  test("keeps wall-mounted furniture in front of rebuilt wall sprites during partial updates", () => {
    const scene = createScene();
    const wallFurniture = createFurnitureItem({
      id: "wall-art",
      assetId: "wall-art-front",
      label: "Wall Art",
      placement: "wall",
      col: 0,
      row: 0,
    });
    const floorFurniture = createFurnitureItem({
      id: "desk-2",
      assetId: "desk-front",
      label: "Desk Front",
      placement: "floor",
      col: 1,
      row: 0,
    });
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 1,
      cellSize: 16,
      tiles: [
        { kind: "wall", tileId: 8 },
        { kind: "floor", tileId: 0 },
      ],
      furniture: [wallFurniture, floorFurniture],
      characters: [],
    };

    const renderable = renderOfficeLayout(
      scene as unknown as Phaser.Scene,
      layout,
      {
        worldOffsetY: 32,
      },
    );
    const initialWallSprite = findWallImages(scene)[0]!;
    const wallFurnitureContainer = scene.add.container.mock.results[2]
      ?.value as FakeContainer;

    renderable.partialUpdate({
      ...layout,
      furniture: [
        wallFurniture,
        createFurnitureItem({
          id: "desk-2",
          assetId: "desk-right",
          label: "Desk Right",
          placement: "floor",
          col: 1,
          row: 0,
          renderAsset: {
            atlasKey: "desk-right",
            atlasFrame: { x: 16, y: 0, w: 16, h: 16 },
          },
        }),
      ],
    });

    const rebuiltWallSprite = findWallImages(scene)[1]!;

    expect(initialWallSprite.destroyed).toBe(true);
    expect(wallFurnitureContainer.destroyed).toBe(false);
    expect(wallFurnitureContainer.depth).toBeGreaterThan(
      rebuiltWallSprite.depth,
    );
  });

  test("keeps surface furniture in front of a 2x2 table support", () => {
    const scene = createScene();
    const table = createFurnitureItem({
      id: "table-1",
      assetId: "table-1",
      label: "Large Coffee Table",
      category: "desks" as never,
      placement: "floor",
      col: 0,
      row: 0,
      width: 2,
      height: 2,
    });
    const monitor = createFurnitureItem({
      id: "monitor-1",
      assetId: "monitor-1",
      label: "Monitor - Front - Off",
      category: "electronics" as never,
      placement: "surface",
      col: 0,
      row: 0,
      width: 1,
      height: 1,
    });
    const layout: OfficeSceneLayout = {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 4 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
      furniture: [table, monitor],
      characters: [],
    };

    renderOfficeLayout(scene as unknown as Phaser.Scene, layout);

    const tableContainer = scene.add.container.mock.results[2]
      ?.value as FakeContainer;
    const monitorContainer = scene.add.container.mock.results[3]
      ?.value as FakeContainer;

    expect(tableContainer.depth).toBe(32);
    expect(monitorContainer.depth).toBeGreaterThan(tableContainer.depth);
  });

  test("keeps surface furniture in front of a 1x2 bench support", () => {
    const scene = createScene();
    const bench = createFurnitureItem({
      id: "bench-1",
      assetId: "bench-1",
      label: "Wooden Table - Vertical",
      category: "desks" as never,
      placement: "floor",
      col: 0,
      row: 0,
      width: 1,
      height: 2,
    });
    const monitor = createFurnitureItem({
      id: "monitor-2",
      assetId: "monitor-2",
      label: "Monitor - Front - Off",
      category: "electronics" as never,
      placement: "surface",
      col: 0,
      row: 0,
      width: 1,
      height: 1,
    });
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 2,
      cellSize: 16,
      tiles: Array.from({ length: 2 }, () => ({
        kind: "floor" as const,
        tileId: 0,
      })),
      furniture: [bench, monitor],
      characters: [],
    };

    renderOfficeLayout(scene as unknown as Phaser.Scene, layout);

    const benchContainer = scene.add.container.mock.results[2]
      ?.value as FakeContainer;
    const monitorContainer = scene.add.container.mock.results[3]
      ?.value as FakeContainer;

    expect(benchContainer.depth).toBe(32);
    expect(monitorContainer.depth).toBeGreaterThan(benchContainer.depth);
  });

  test("floor tiles are baked into a single RenderTexture sized to the full tile area", () => {
    // Individual Image objects placed edge-to-edge create sub-pixel gaps at
    // tile boundaries under non-integer CSS canvas scale. A single RenderTexture
    // has no inter-tile GPU boundaries, making seams impossible.
    const scene = createScene();
    const cellSize = 16;
    const layout: OfficeSceneLayout = {
      cols: 3,
      rows: 2,
      cellSize,
      tiles: [
        { kind: "floor", tileId: 0, pattern: "environment.floors.pattern-01" },
        { kind: "floor", tileId: 0, pattern: "environment.floors.pattern-01" },
        { kind: "void", tileId: 0 },
        { kind: "floor", tileId: 0, pattern: "environment.floors.pattern-01" },
        { kind: "wall", tileId: 8 },
        { kind: "floor", tileId: 0, pattern: "environment.floors.pattern-01" },
      ],
      furniture: [],
      characters: [],
    };

    renderOfficeLayout(scene as unknown as Phaser.Scene, layout);

    // Exactly one RenderTexture must be created for the full tile area.
    expect(scene.add.renderTexture).toHaveBeenCalledTimes(1);
    const rt = scene.add.renderTexture.mock.results[0]!
      .value as FakeRenderTexture;
    expect(rt.width).toBe(layout.cols * cellSize);
    expect(rt.height).toBe(layout.rows * cellSize);

    // Four floor tiles → four batchDraw calls; void and wall tiles are skipped.
    expect(rt.batchDrawCalls).toBe(4);

    // Floor tiles must NOT be added as individual Image objects to the scene.
    const floorImageCalls = scene.add.image.mock.calls.filter(
      (args) =>
        typeof args[3] === "string" &&
        args[3].startsWith("environment.floors."),
    );
    expect(floorImageCalls).toHaveLength(0);
  });

  test("floor tile RenderTexture is replaced on partialUpdate", () => {
    const scene = createScene();
    const cellSize = 16;
    const floorTile = {
      kind: "floor" as const,
      tileId: 0,
      pattern: "environment.floors.pattern-01",
    };
    const layout: OfficeSceneLayout = {
      cols: 1,
      rows: 1,
      cellSize,
      tiles: [floorTile],
      furniture: [],
      characters: [],
    };

    const renderable = renderOfficeLayout(
      scene as unknown as Phaser.Scene,
      layout,
    );
    const firstRT = scene.add.renderTexture.mock.results[0]!
      .value as FakeRenderTexture;

    renderable.partialUpdate({ ...layout, tiles: [floorTile] });

    // partialUpdate must destroy the old RT and allocate a fresh one.
    expect(firstRT.destroyed).toBe(true);
    expect(scene.add.renderTexture).toHaveBeenCalledTimes(2);
  });
});
