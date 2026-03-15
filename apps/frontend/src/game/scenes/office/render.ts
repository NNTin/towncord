import Phaser from "phaser";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneLayout,
} from "./bootstrap";
import { resolveOfficeTileFill } from "./colors";
import { FURNITURE_PALETTE_ITEMS, type FurniturePaletteItem } from "../../office/officeFurniturePalette";

const GRID_LINE_COLOR = 0x0f172a;
const VOID_TILE_COLOR = 0x020617;
const FLOOR_INSET_ALPHA = 0.18;
const WALL_INSET_ALPHA = 0.28;
const SHADOW_COLOR = 0x020617;
const LABEL_TEXT_COLOR = "#f8fafc";
const CHARACTER_LABEL_TEXT_COLOR = "#0f172a";
const DONARG_OFFICE_FURNITURE_ATLAS_KEY = "donarg.office.furniture";

const FURNITURE_PALETTE_MAP = new Map<string, FurniturePaletteItem>(
  FURNITURE_PALETTE_ITEMS.map((item) => [item.id, item]),
);

type OfficeRenderableTargetKind = "furniture" | "character";

type OfficeRenderableTarget = {
  kind: OfficeRenderableTargetKind;
  id: string;
  label: string;
  bounds: Phaser.Geom.Rectangle;
};

export type OfficeSceneRenderIndex = {
  furniture: OfficeRenderableTarget[];
  characters: OfficeRenderableTarget[];
};

export type OfficeLayoutRenderable = {
  renderIndex: OfficeSceneRenderIndex;
  destroy(): void;
};

type RenderOfficeLayoutOptions = {
  /** World-space X offset applied to all game objects (default: 0). */
  worldOffsetX?: number;
  /** World-space Y offset applied to all game objects (default: 0). */
  worldOffsetY?: number;
  /**
   * Depth assigned to the floor/wall tile graphics layer.
   * Default: 0 (suitable for standalone OfficeScene).
   * Use -500 when rendering inside WorldScene above terrain.
   */
  tileDepth?: number;
  /**
   * Additional row offset added to furniture/character depth to place them
   * correctly relative to world entities. Use Math.round(anchorY16 / 3) when
   * embedding in WorldScene.
   * Default: 0.
   */
  depthAnchorRow?: number;
};

// TODO(architecture-review): renderOfficeLayout() creates individual game objects (Graphics,
// Containers) and adds them directly to the passed scene. There is no parent Phaser Group or
// Container wrapping the entire office. This makes it impossible to move, cull, or toggle
// the whole office as a unit. Wrapping all child objects in a single top-level Container
// would simplify translation (worldOffsetX/Y) and enable frustum-culling the office in one
// call.
export function renderOfficeLayout(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  options: RenderOfficeLayoutOptions = {},
): OfficeLayoutRenderable {
  const {
    worldOffsetX = 0,
    worldOffsetY = 0,
    tileDepth = 0,
    depthAnchorRow = 0,
  } = options;

  const tilesGraphics = renderTiles(scene, layout, worldOffsetX, worldOffsetY, tileDepth);

  const furnitureEntries = layout.furniture.map((item) => {
    const paletteItem = FURNITURE_PALETTE_MAP.get(item.assetId);
    const { target, container } = renderFurniture(scene, layout, item, paletteItem, worldOffsetX, worldOffsetY, depthAnchorRow);
    return { target, container };
  });

  const characterEntries = layout.characters.map((actor) => {
    const { target, container } = renderCharacter(scene, layout, actor, worldOffsetX, worldOffsetY, depthAnchorRow);
    return { target, container };
  });

  const renderIndex: OfficeSceneRenderIndex = {
    furniture: furnitureEntries.map((e) => e.target),
    characters: characterEntries.map((e) => e.target),
  };

  return {
    renderIndex,
    destroy() {
      tilesGraphics.destroy();
      for (const e of furnitureEntries) {
        e.container.destroy(true);
      }
      for (const e of characterEntries) {
        e.container.destroy(true);
      }
    },
  };
}

function renderTiles(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  worldOffsetX: number,
  worldOffsetY: number,
  tileDepth: number,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.setPosition(worldOffsetX, worldOffsetY);
  graphics.setDepth(tileDepth);
  const { cols, rows, cellSize, tiles } = layout;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const tile = tiles[row * cols + col];
      if (!tile) {
        continue;
      }

      const x = col * cellSize;
      const y = row * cellSize;
      const fill = tile.kind === "void" ? VOID_TILE_COLOR : resolveOfficeTileFill(tile.kind, tile.tint);
      const strokeAlpha = tile.kind === "wall" ? 0.45 : 0.22;
      const insetAlpha = tile.kind === "wall" ? WALL_INSET_ALPHA : FLOOR_INSET_ALPHA;

      graphics.fillStyle(fill, tile.kind === "void" ? 0.55 : 1);
      graphics.fillRect(x, y, cellSize, cellSize);
      graphics.lineStyle(1, GRID_LINE_COLOR, strokeAlpha);
      graphics.strokeRect(x, y, cellSize, cellSize);

      if (tile.kind !== "void") {
        graphics.fillStyle(0xffffff, insetAlpha);
        graphics.fillRect(x + 2, y + 2, cellSize - 4, Math.max(2, Math.floor(cellSize * 0.14)));
      }

      if (tile.kind === "wall") {
        graphics.fillStyle(SHADOW_COLOR, 0.22);
        graphics.fillRect(
          x,
          y + cellSize - Math.max(4, Math.floor(cellSize * 0.18)),
          cellSize,
          Math.max(4, Math.floor(cellSize * 0.18)),
        );
      }
    }
  }

  return graphics;
}

function renderFurniture(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  item: OfficeSceneFurniture,
  paletteItem: FurniturePaletteItem | undefined,
  worldOffsetX: number,
  worldOffsetY: number,
  depthAnchorRow: number,
): { target: OfficeRenderableTarget; container: Phaser.GameObjects.Container } {
  const x = item.col * layout.cellSize;
  const y = item.row * layout.cellSize;
  const width = item.width * layout.cellSize;
  const height = item.height * layout.cellSize;
  const container = scene.add.container(x + worldOffsetX, y + worldOffsetY);

  if (paletteItem) {
    renderFurnitureSprite(scene, container, paletteItem, width, height);
  } else {
    renderFurnitureFallback(scene, container, layout, item, width, height);
  }

  container.setDepth(resolveRenderableDepth(depthAnchorRow + item.row + item.height, item.placement === "wall" ? 6 : 18));

  const target: OfficeRenderableTarget = {
    kind: "furniture",
    id: item.id,
    label: item.label,
    bounds: new Phaser.Geom.Rectangle(x + worldOffsetX, y + worldOffsetY, width, height),
  };

  return { target, container };
}

function renderFurnitureSprite(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  paletteItem: FurniturePaletteItem,
  width: number,
  height: number,
): void {
  const { atlasFrame } = paletteItem;
  const sprite = scene.add.image(width / 2, height / 2, DONARG_OFFICE_FURNITURE_ATLAS_KEY, paletteItem.atlasKey);
  sprite.setOrigin(0.5, 0.5);
  sprite.setScale(width / atlasFrame.w, height / atlasFrame.h);
  container.add(sprite);
}

function renderFurnitureFallback(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  layout: OfficeSceneLayout,
  item: OfficeSceneFurniture,
  width: number,
  height: number,
): void {
  const label = shortenLabel(item.label, Math.max(6, item.width * 6));

  if (item.placement === "wall") {
    const frameShadow = scene.add.rectangle(
      width / 2 + 2,
      height / 2 + 2,
      Math.max(layout.cellSize * 0.7, width - 10),
      Math.max(layout.cellSize * 0.7, height - 10),
      SHADOW_COLOR,
      0.22,
    );
    frameShadow.setStrokeStyle(1, 0x000000, 0.1);

    const frame = scene.add.rectangle(
      width / 2,
      height / 2,
      Math.max(layout.cellSize * 0.7, width - 10),
      Math.max(layout.cellSize * 0.7, height - 10),
      item.color,
      0.96,
    );
    frame.setStrokeStyle(2, item.accentColor, 0.95);

    const mat = scene.add.rectangle(
      width / 2,
      height / 2,
      Math.max(layout.cellSize * 0.46, width - 22),
      Math.max(layout.cellSize * 0.46, height - 22),
      0x1e293b,
      0.86,
    );

    container.add([frameShadow, frame, mat]);
  } else {
    const shadow = scene.add.ellipse(
      width / 2 + 2,
      height - Math.max(6, layout.cellSize * 0.14),
      Math.max(layout.cellSize * 0.6, width - 10),
      Math.max(8, layout.cellSize * 0.26),
      SHADOW_COLOR,
      0.2,
    );
    const body = scene.add.rectangle(
      width / 2,
      height / 2,
      Math.max(layout.cellSize * 0.6, width - 6),
      Math.max(layout.cellSize * 0.6, height - 6),
      item.color,
      0.98,
    );
    body.setStrokeStyle(2, item.accentColor, 0.92);

    const accent = scene.add.rectangle(
      width / 2,
      Math.max(8, layout.cellSize * 0.22),
      Math.max(layout.cellSize * 0.34, width - 14),
      Math.max(4, Math.min(8, height * 0.18)),
      item.accentColor,
      0.9,
    );

    container.add([shadow, body, accent]);
  }

  const text = scene.add.text(width / 2, height / 2, label, {
    fontFamily: "monospace",
    fontSize: `${Math.max(10, Math.min(13, layout.cellSize * 0.26))}px`,
    color: LABEL_TEXT_COLOR,
  });
  text.setOrigin(0.5);
  text.setAlpha(0.88);
  container.add(text);
}

function renderCharacter(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  actor: OfficeSceneCharacter,
  worldOffsetX: number,
  worldOffsetY: number,
  depthAnchorRow: number,
): { target: OfficeRenderableTarget; container: Phaser.GameObjects.Container } {
  const cellSize = layout.cellSize;
  const x = actor.col * cellSize;
  const y = actor.row * cellSize;
  const container = scene.add.container(x + worldOffsetX, y + worldOffsetY);
  const shadow = scene.add.ellipse(
    cellSize / 2,
    cellSize * 0.88,
    cellSize * 0.46,
    Math.max(8, cellSize * 0.18),
    SHADOW_COLOR,
    0.22,
  );
  const body = scene.add.ellipse(
    cellSize / 2,
    cellSize * 0.63,
    cellSize * 0.5,
    cellSize * 0.56,
    actor.color,
    0.98,
  );
  body.setStrokeStyle(2, actor.accentColor, 0.94);
  const head = scene.add.circle(
    cellSize / 2,
    cellSize * 0.28,
    cellSize * 0.14,
    actor.accentColor,
    1,
  );
  const badge = scene.add.text(cellSize / 2, cellSize * 0.64, actor.glyph, {
    fontFamily: "monospace",
    fontSize: `${Math.max(11, Math.round(cellSize * 0.26))}px`,
    color: CHARACTER_LABEL_TEXT_COLOR,
    fontStyle: "bold",
  });
  badge.setOrigin(0.5);

  container.add([shadow, body, head, badge]);
  container.setDepth(resolveRenderableDepth(depthAnchorRow + actor.row + 1, 34));

  const target: OfficeRenderableTarget = {
    kind: "character",
    id: actor.id,
    label: actor.label,
    bounds: new Phaser.Geom.Rectangle(x + worldOffsetX, y + worldOffsetY, cellSize, cellSize),
  };

  return { target, container };
}

// TODO(architecture-review): resolveRenderableDepth() encodes both spatial (row) and
// categorical (layer) concerns into a single depth integer using the formula
// `bottomRow * 100 + layer`. The multiplier 100 and the layer slot values (6 for wall
// furniture, 18 for floor furniture, 34 for characters) are undocumented magic numbers.
// Document the layer budget (e.g. max ~100 rows × 100 = 10 000 depth units) and give each
// slot a named constant so the intended draw order is explicit. Also note that this depth
// space overlaps with the world-entity depth space, which has no y-sort at all.
function resolveRenderableDepth(bottomRow: number, layer: number): number {
  return bottomRow * 100 + layer;
}

function shortenLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(1, maxLength - 3))}...`;
}
