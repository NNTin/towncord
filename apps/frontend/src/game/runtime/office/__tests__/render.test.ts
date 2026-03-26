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

  setDepth(_depth: number): this {
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

  removeAll(_destroy?: boolean): this {
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
    image: vi.fn(() => new FakeDisplayObject()),
    ellipse: vi.fn(() => new FakeDisplayObject()),
    circle: vi.fn(() => new FakeDisplayObject()),
    rectangle: vi.fn(() => new FakeDisplayObject()),
    text: vi.fn(() => new FakeDisplayObject()),
  };

  return { add };
}

function createLayout(characters: OfficeSceneLayout["characters"]): OfficeSceneLayout {
  return {
    cols: 2,
    rows: 2,
    cellSize: 16,
    tiles: [
      { kind: "floor", tileId: 0, tint: 0x475569, pattern: "environment.floors.pattern-01" },
      { kind: "void", tileId: 0 },
      { kind: "void", tileId: 0 },
      { kind: "wall", tileId: 8 },
    ],
    furniture: [],
    characters,
  };
}

describe("renderOfficeLayout", () => {
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

    const renderable = renderOfficeLayout(scene as unknown as Phaser.Scene, layout);
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
});
