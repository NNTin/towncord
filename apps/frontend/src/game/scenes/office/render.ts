import Phaser from "phaser";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneLayout,
  OfficeSceneTile,
} from "./bootstrap";
import { FURNITURE_ALL_ITEMS, type FurniturePaletteItem } from "../../office/officeFurniturePalette";

const GRID_LINE_COLOR = 0x0f172a;
const VOID_TILE_COLOR = 0x020617;
const SHADOW_COLOR = 0x020617;
const LABEL_TEXT_COLOR = "#f8fafc";
const CHARACTER_LABEL_TEXT_COLOR = "#0f172a";
const DONARG_OFFICE_FURNITURE_ATLAS_KEY = "donarg.office.furniture";
const DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY = "donarg.office.environment";
const FLOOR_PATTERN_FRAME = "environment.floors.pattern-01#0";

/**
 * Depth encoding: depth = bottomRow * DEPTH_ROWS_PER_SLOT + layer.
 * Max budget: ~100 rows × 100 slots = 10 000 depth units per office.
 */
const DEPTH_ROWS_PER_SLOT = 100;
const DEPTH_LAYER_WALL_FURNITURE = 6;
const DEPTH_LAYER_FLOOR_FURNITURE = 18;
const DEPTH_LAYER_CHARACTER = 34;

const FURNITURE_PALETTE_MAP = new Map<string, FurniturePaletteItem>(
  FURNITURE_ALL_ITEMS.map((item) => [item.id, item]),
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
  /** Top-level Container wrapping all office game objects. Use this to move, cull, or toggle the whole office as a unit. */
  container: Phaser.GameObjects.Container;
  renderIndex: OfficeSceneRenderIndex;
  /**
   * Performs a partial update of the rendered office to match `newLayout`.
   *
   * - Tile graphics: cleared and redrawn in a single Graphics pass (no container
   *   destruction — far cheaper than a full rebuild for large layouts).
   * - Furniture: diffed by `id`.  Unchanged furniture containers are kept alive;
   *   removed items are destroyed; new items are created.  Characters are always
   *   rebuilt because they are derived data and rarely change.
   *
   * Returns the updated `renderIndex`.
   */
  partialUpdate(newLayout: OfficeSceneLayout): OfficeSceneRenderIndex;
  destroy(): void;
};

type RenderOfficeLayoutOptions = {
  /** World-space X offset applied to the top-level office Container (default: 0). */
  worldOffsetX?: number;
  /** World-space Y offset applied to the top-level office Container (default: 0). */
  worldOffsetY?: number;
  /**
   * Depth assigned to the floor/wall tile graphics layer.
   * Default: 0 (suitable for standalone OfficeScene).
   * Use `RENDER_LAYERS.OFFICE_FLOOR` (-500) when rendering inside WorldScene above terrain.
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

  // Single top-level container for the entire office. All child objects are
  // positioned relative to this container, so translating the container moves
  // the whole office in one call and frustum-culling can target it directly.
  const officeContainer = scene.add.container(worldOffsetX, worldOffsetY);

  // Children use local (container-relative) coordinates — no worldOffset needed.
  const tileLayer = renderTiles(scene, layout, 0, 0, tileDepth);
  officeContainer.add(tileLayer);

  const furnitureEntries = layout.furniture.map((item) => {
    const paletteItem = FURNITURE_PALETTE_MAP.get(item.assetId);
    const { target, container } = renderFurniture(scene, layout, item, paletteItem, 0, 0, depthAnchorRow);
    officeContainer.add(container);
    // bounds must be in world space so callers can hit-test against world coordinates
    target.bounds.x += worldOffsetX;
    target.bounds.y += worldOffsetY;
    return { id: item.id, target, container };
  });

  const characterEntries = layout.characters.map((actor) => {
    const { target, container } = renderCharacter(scene, layout, actor, 0, 0, depthAnchorRow);
    officeContainer.add(container);
    target.bounds.x += worldOffsetX;
    target.bounds.y += worldOffsetY;
    return { target, container };
  });

  // Live furniture map: id → { target, container } for O(1) diff lookups.
  const furnitureMap = new Map(furnitureEntries.map((e) => [e.id, { target: e.target, container: e.container }]));

  function buildRenderIndex(): OfficeSceneRenderIndex {
    return {
      furniture: [...furnitureMap.values()].map((e) => e.target),
      characters: characterEntries.map((e) => e.target),
    };
  }

  const renderable: OfficeLayoutRenderable = {
    container: officeContainer,
    renderIndex: buildRenderIndex(),

    partialUpdate(newLayout: OfficeSceneLayout): OfficeSceneRenderIndex {
      // --- Tile layer: remove all children and rebuild ---
      tileLayer.removeAll(true);
      buildTileObjects(scene, tileLayer, newLayout);

      // --- Furniture: diff by id ---
      const newFurnitureIds = new Set(newLayout.furniture.map((f) => f.id));

      // Remove stale furniture containers.
      for (const [id, entry] of furnitureMap) {
        if (!newFurnitureIds.has(id)) {
          officeContainer.remove(entry.container, true);
          furnitureMap.delete(id);
        }
      }

      // Add new furniture containers.
      for (const item of newLayout.furniture) {
        if (!furnitureMap.has(item.id)) {
          const paletteItem = FURNITURE_PALETTE_MAP.get(item.assetId);
          const { target, container } = renderFurniture(scene, newLayout, item, paletteItem, 0, 0, depthAnchorRow);
          officeContainer.add(container);
          target.bounds.x += worldOffsetX;
          target.bounds.y += worldOffsetY;
          furnitureMap.set(item.id, { target, container });
        }
      }

      // --- Characters: always rebuild (derived, rarely changes) ---
      for (const entry of characterEntries) {
        officeContainer.remove(entry.container, true);
      }
      characterEntries.length = 0;
      for (const actor of newLayout.characters) {
        const { target, container } = renderCharacter(scene, newLayout, actor, 0, 0, depthAnchorRow);
        officeContainer.add(container);
        target.bounds.x += worldOffsetX;
        target.bounds.y += worldOffsetY;
        characterEntries.push({ target, container });
      }

      renderable.renderIndex = buildRenderIndex();
      return renderable.renderIndex;
    },

    destroy() {
      // Destroying the top-level container also destroys all its children.
      officeContainer.destroy(true);
    },
  };

  return renderable;
}

function renderTiles(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  worldOffsetX: number,
  worldOffsetY: number,
  tileDepth: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(worldOffsetX, worldOffsetY);
  container.setDepth(tileDepth);
  buildTileObjects(scene, container, layout);
  return container;
}

function buildTileObjects(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  layout: OfficeSceneLayout,
): void {
  const { cols, rows, cellSize, tiles } = layout;
  const half = cellSize / 2;

  // Base graphics for void tiles
  const baseGraphics = scene.add.graphics();
  container.add(baseGraphics);

  // Pass 1: tile base sprites (floor sprites, wall sprites, void rects)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = tiles[row * cols + col];
      const x = col * cellSize;
      const y = row * cellSize;

      if (!tile || tile.kind === "void") {
        baseGraphics.fillStyle(VOID_TILE_COLOR, 0.55);
        baseGraphics.fillRect(x, y, cellSize, cellSize);
        continue;
      }

      if (tile.kind === "floor") {
        const img = scene.add.image(x + half, y + half, DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY, FLOOR_PATTERN_FRAME);
        img.setDisplaySize(cellSize, cellSize);
        if (typeof tile.tint === "number") {
          img.setTint(tile.tint);
        }
        container.add(img);
      } else if (tile.kind === "wall") {
        const bitmask = computeWallBitmask(tiles, cols, rows, col, row);
        const maskId = String(bitmask).padStart(2, "0");
        const img = scene.add.image(x + half, y + half, DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY, `environment.walls.mask-${maskId}#0`);
        img.setDisplaySize(cellSize, cellSize);
        container.add(img);
      }
    }
  }

  // Pass 2: grid lines on top of everything
  const gridGraphics = scene.add.graphics();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = tiles[row * cols + col];
      if (!tile || tile.kind === "void") continue;
      const x = col * cellSize;
      const y = row * cellSize;
      const strokeAlpha = tile.kind === "wall" ? 0.45 : 0.22;
      gridGraphics.lineStyle(1, GRID_LINE_COLOR, strokeAlpha);
      gridGraphics.strokeRect(x, y, cellSize, cellSize);
    }
  }
  container.add(gridGraphics);
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

  container.setDepth(resolveRenderableDepth(depthAnchorRow + item.row + item.height, item.placement === "wall" ? DEPTH_LAYER_WALL_FURNITURE : DEPTH_LAYER_FLOOR_FURNITURE));

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
  container.setDepth(resolveRenderableDepth(depthAnchorRow + actor.row + 1, DEPTH_LAYER_CHARACTER));

  const target: OfficeRenderableTarget = {
    kind: "character",
    id: actor.id,
    label: actor.label,
    bounds: new Phaser.Geom.Rectangle(x + worldOffsetX, y + worldOffsetY, cellSize, cellSize),
  };

  return { target, container };
}

// Note: this depth space overlaps with the world-entity depth space, which has no y-sort.
function resolveRenderableDepth(bottomRow: number, layer: number): number {
  return bottomRow * DEPTH_ROWS_PER_SLOT + layer;
}

function computeWallBitmask(
  tiles: OfficeSceneTile[],
  cols: number,
  rows: number,
  col: number,
  row: number,
): number {
  const isWall = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
    return tiles[r * cols + c]?.kind === "wall";
  };
  let mask = 0;
  if (isWall(col, row - 1)) mask |= 1;  // North
  if (isWall(col + 1, row)) mask |= 2;  // East
  if (isWall(col, row + 1)) mask |= 4;  // South
  if (isWall(col - 1, row)) mask |= 8;  // West
  return mask;
}

function shortenLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(1, maxLength - 3))}...`;
}
