import Phaser from "phaser";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneFurnitureRenderAsset,
  OfficeSceneLayout,
  OfficeSceneTile,
} from "./contracts";

const SHADOW_COLOR = 0x020617;
const LABEL_TEXT_COLOR = "#f8fafc";
const CHARACTER_LABEL_TEXT_COLOR = "#0f172a";
const DONARG_OFFICE_FURNITURE_ATLAS_KEY = "donarg.office.furniture";
const DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY = "donarg.office.environment";
const FLOOR_PATTERN_FRAME = "environment.floors.pattern-01#0";
const WALL_MOUNT_DEPTH_OFFSET = 0.5;
const CHAIR_DEPTH_OFFSET = 0.5;
const SURFACE_DEPTH_OFFSET = 0.5;

type OfficeRenderableTargetKind = "furniture" | "character";

type OfficeRenderableTarget = {
  kind: OfficeRenderableTargetKind;
  id: string;
  label: string;
  bounds: Phaser.Geom.Rectangle;
};

type FurnitureRenderableEntry = {
  target: OfficeRenderableTarget;
  container: Phaser.GameObjects.Container;
  renderSignature: string;
};

export type OfficeSceneRenderIndex = {
  furniture: OfficeRenderableTarget[];
  characters: OfficeRenderableTarget[];
};

export type OfficeLayoutRenderable = {
  container: Phaser.GameObjects.Container;
  renderIndex: OfficeSceneRenderIndex;
  partialUpdate(newLayout: OfficeSceneLayout): OfficeSceneRenderIndex;
  destroy(): void;
};

type RenderOfficeLayoutOptions = {
  worldOffsetX?: number;
  worldOffsetY?: number;
  tileDepth?: number;
};

export function renderOfficeLayout(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  options: RenderOfficeLayoutOptions = {},
): OfficeLayoutRenderable {
  const { worldOffsetX = 0, worldOffsetY = 0, tileDepth = 0 } = options;

  return new OfficeLayoutRenderableImpl(
    scene,
    layout,
    worldOffsetX,
    worldOffsetY,
    tileDepth,
  );
}

class OfficeLayoutRenderableImpl implements OfficeLayoutRenderable {
  public renderIndex: OfficeSceneRenderIndex;
  /**
   * Floor-tile container only. Sits at tileDepth (RENDER_LAYERS.OFFICE_FLOOR,
   * –500) so floor tiles are always behind entities and all y-sorted objects.
   */
  public readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly tileLayer: Phaser.GameObjects.Container;
  private readonly worldOffsetX: number;
  private readonly worldOffsetY: number;
  private readonly furnitureMap = new Map<string, FurnitureRenderableEntry>();
  private characterEntries: Array<{
    target: OfficeRenderableTarget;
    container: Phaser.GameObjects.Container;
  }> = [];
  private characterSource: readonly OfficeSceneCharacter[];
  /**
   * Wall, furniture, and character containers are kept as direct scene-level
   * objects (not inside `this.container`) so their depth values participate in
   * the same y-sort space as moving entities.  Each object's depth equals the
   * world-pixel Y of its south edge, matching the coordinate space that
   * EntitySystem uses for entity.sprite.setDepth(entity.position.y).
   */
  private wallSprites: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    layout: OfficeSceneLayout,
    worldOffsetX: number,
    worldOffsetY: number,
    tileDepth: number,
  ) {
    this.scene = scene;
    this.worldOffsetX = worldOffsetX;
    this.worldOffsetY = worldOffsetY;

    // Floor-tile container only — its depth must be set here because the
    // container is the scene-level object (depth on the tileLayer child inside
    // it would be ignored by Phaser's Container renderer).
    this.container = scene.add.container(worldOffsetX, worldOffsetY);
    this.container.setDepth(tileDepth);
    this.tileLayer = renderTiles(scene, layout, 0, 0, tileDepth);
    this.container.add(this.tileLayer);

    this.wallSprites = this.buildWallSprites(layout);

    this.characterSource = layout.characters;
    this.syncFurniture(layout);
    this.characterEntries = this.buildCharacterEntries(layout);
    this.renderIndex = this.buildRenderIndex();
  }

  public partialUpdate(newLayout: OfficeSceneLayout): OfficeSceneRenderIndex {
    this.tileLayer.removeAll(true);
    buildTileObjects(this.scene, this.tileLayer, newLayout);

    for (const sprite of this.wallSprites) {
      sprite.destroy();
    }
    this.wallSprites = this.buildWallSprites(newLayout);

    this.syncFurniture(newLayout);
    this.syncCharacters(newLayout);

    this.renderIndex = this.buildRenderIndex();
    return this.renderIndex;
  }

  public destroy(): void {
    this.container.destroy(true);
    for (const sprite of this.wallSprites) {
      sprite.destroy();
    }
    this.wallSprites = [];
    for (const entry of this.furnitureMap.values()) {
      entry.container.destroy(true);
    }
    this.furnitureMap.clear();
    for (const entry of this.characterEntries) {
      entry.container.destroy(true);
    }
    this.characterEntries = [];
  }

  private buildWallSprites(
    layout: OfficeSceneLayout,
  ): Phaser.GameObjects.Image[] {
    const { cols, rows, cellSize, tiles } = layout;
    const half = cellSize / 2;
    const sprites: Phaser.GameObjects.Image[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = tiles[row * cols + col];
        if (!tile || tile.kind !== "wall") continue;

        const bitmask = computeWallBitmask(tiles, cols, rows, col, row);
        const maskId = String(bitmask).padStart(2, "0");
        const worldX = this.worldOffsetX + col * cellSize + half;
        const worldY = this.worldOffsetY + row * cellSize;

        const img = this.scene.add.image(
          worldX,
          worldY,
          DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY,
          `environment.walls.mask-${maskId}#0`,
        );
        img.setDisplaySize(cellSize, cellSize * 2);
        if (typeof tile.tint === "number") {
          img.setTint(tile.tint);
        }
        // Depth equals the south-edge world-pixel Y of this wall cell so the
        // sprite participates in the same y-sort space as entity sprites.
        // An entity whose position.y is less than this depth will render behind
        // the wall; one with a higher position.y will render in front.
        img.setDepth(this.worldOffsetY + (row + 1) * cellSize);
        sprites.push(img);
      }
    }

    return sprites;
  }

  private buildRenderIndex(): OfficeSceneRenderIndex {
    return {
      furniture: [...this.furnitureMap.values()].map((entry) => entry.target),
      characters: this.characterEntries.map((entry) => entry.target),
    };
  }

  private syncFurniture(layout: OfficeSceneLayout): void {
    const newFurnitureIds = new Set(
      layout.furniture.map((furniture) => furniture.id),
    );

    for (const [id, entry] of this.furnitureMap) {
      if (!newFurnitureIds.has(id)) {
        entry.container.destroy(true);
        this.furnitureMap.delete(id);
      }
    }

    for (const item of layout.furniture) {
      const nextRenderSignature = buildFurnitureRenderSignature(item);
      const existing = this.furnitureMap.get(item.id);
      if (existing?.renderSignature === nextRenderSignature) {
        continue;
      }

      existing?.container.destroy(true);
      const { target, container } = renderFurniture(
        this.scene,
        layout,
        item,
        this.worldOffsetX,
        this.worldOffsetY,
      );
      // container is a direct scene-level object — do NOT add to this.container
      // so its depth participates in the scene's y-sort.
      this.furnitureMap.set(item.id, {
        target,
        container,
        renderSignature: nextRenderSignature,
      });
    }
  }

  private syncCharacters(newLayout: OfficeSceneLayout): void {
    if (newLayout.characters === this.characterSource) {
      return;
    }

    for (const entry of this.characterEntries) {
      entry.container.destroy(true);
    }
    this.characterEntries = this.buildCharacterEntries(newLayout);
    this.characterSource = newLayout.characters;
  }

  private buildCharacterEntries(layout: OfficeSceneLayout): Array<{
    target: OfficeRenderableTarget;
    container: Phaser.GameObjects.Container;
  }> {
    return layout.characters.map((actor) => {
      const { target, container } = renderCharacter(
        this.scene,
        layout,
        actor,
        this.worldOffsetX,
        this.worldOffsetY,
      );
      // container is a direct scene-level object — do NOT add to this.container.
      return { target, container };
    });
  }
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

  // Bake all floor tiles into one RenderTexture. A single quad has no
  // inter-tile GPU boundaries, so sub-pixel gaps from floating-point
  // rasterization or non-integer CSS canvas scale are impossible.
  const rt = scene.add.renderTexture(0, 0, cols * cellSize, rows * cellSize);
  rt.setOrigin(0, 0);
  container.add(rt);

  const scratch = scene.make.image({
    key: DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY,
    add: false,
  });

  rt.beginDraw();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = tiles[row * cols + col];
      if (!tile || tile.kind !== "floor") continue;

      const frameKey = tile.pattern ? `${tile.pattern}#0` : FLOOR_PATTERN_FRAME;
      scratch.setTexture(DONARG_OFFICE_ENVIRONMENT_ATLAS_KEY, frameKey);
      scratch.setDisplaySize(cellSize, cellSize);
      if (typeof tile.tint === "number") {
        scratch.setTint(tile.tint);
      } else {
        scratch.clearTint();
      }
      scratch.setPosition(
        col * cellSize + cellSize / 2,
        row * cellSize + cellSize / 2,
      );
      rt.batchDraw(scratch);
    }
  }

  rt.endDraw();
  scratch.destroy();
}

function renderFurniture(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  item: OfficeSceneFurniture,
  worldOffsetX: number,
  worldOffsetY: number,
): { target: OfficeRenderableTarget; container: Phaser.GameObjects.Container } {
  const x = item.col * layout.cellSize;
  const y = item.row * layout.cellSize;
  const width = item.width * layout.cellSize;
  const height = item.height * layout.cellSize;
  const container = scene.add.container(x + worldOffsetX, y + worldOffsetY);

  if (item.renderAsset) {
    renderFurnitureSprite(scene, container, item.renderAsset, width, height);
  } else {
    renderFurnitureFallback(scene, container, layout, item, width, height);
  }

  container.setDepth(resolveFurnitureDepth(layout, item, worldOffsetY));

  const target: OfficeRenderableTarget = {
    kind: "furniture",
    id: item.id,
    label: item.label,
    bounds: new Phaser.Geom.Rectangle(
      x + worldOffsetX,
      y + worldOffsetY,
      width,
      height,
    ),
  };

  return { target, container };
}

function resolveFurnitureDepth(
  layout: OfficeSceneLayout,
  item: OfficeSceneFurniture,
  worldOffsetY: number,
): number {
  const southEdgeDepth =
    worldOffsetY + (item.row + item.height) * layout.cellSize;
  if (item.placement === "wall") {
    // Wall sprites render at the wall cell's south edge. Wall-mounted furniture
    // must sit slightly in front of that plane so partial wall rebuilds cannot
    // cover unchanged mounted items that retain their existing containers.
    return southEdgeDepth + WALL_MOUNT_DEPTH_OFFSET;
  }

  if (item.category === "chairs") {
    // Chair sprites can span multiple tiles, but the seat plane still lives on
    // the anchor row. Keep chairs slightly behind that plane so entities on the
    // seat render on top instead of disappearing behind the furniture sprite.
    return worldOffsetY + (item.row + 1) * layout.cellSize - CHAIR_DEPTH_OFFSET;
  }

  if (item.placement === "surface") {
    const supportDepth = resolveSurfaceSupportDepth(layout, item, worldOffsetY);
    if (supportDepth !== null) {
      // Surface items only store their own footprint. On multi-tile tables that
      // footprint can end above the support's south edge, which lets the table
      // render over the item. Keep them slightly in front of the deepest floor
      // support they overlap so they stay visibly on top of the surface.
      return Math.max(southEdgeDepth, supportDepth + SURFACE_DEPTH_OFFSET);
    }
  }

  // South-edge world-pixel Y: entities above this row render behind the
  // furniture; entities below it render in front.
  return southEdgeDepth;
}

function resolveSurfaceSupportDepth(
  layout: OfficeSceneLayout,
  item: OfficeSceneFurniture,
  worldOffsetY: number,
): number | null {
  let deepestSupportDepth: number | null = null;

  for (const candidate of layout.furniture) {
    if (candidate.id === item.id || candidate.placement !== "floor") {
      continue;
    }

    if (!doFurnitureBoundsOverlap(item, candidate)) {
      continue;
    }

    const candidateSouthEdgeDepth =
      worldOffsetY + (candidate.row + candidate.height) * layout.cellSize;
    deepestSupportDepth =
      deepestSupportDepth === null
        ? candidateSouthEdgeDepth
        : Math.max(deepestSupportDepth, candidateSouthEdgeDepth);
  }

  return deepestSupportDepth;
}

function doFurnitureBoundsOverlap(
  left: Pick<OfficeSceneFurniture, "col" | "row" | "width" | "height">,
  right: Pick<OfficeSceneFurniture, "col" | "row" | "width" | "height">,
): boolean {
  return !(
    left.col >= right.col + right.width ||
    left.col + left.width <= right.col ||
    left.row >= right.row + right.height ||
    left.row + left.height <= right.row
  );
}

function buildFurnitureRenderSignature(item: OfficeSceneFurniture): string {
  const renderAssetSignature = item.renderAsset
    ? [
        item.renderAsset.atlasKey,
        item.renderAsset.atlasFrame.x,
        item.renderAsset.atlasFrame.y,
        item.renderAsset.atlasFrame.w,
        item.renderAsset.atlasFrame.h,
      ].join(",")
    : "fallback";

  return [
    item.label,
    item.placement,
    item.col,
    item.row,
    item.width,
    item.height,
    item.color,
    item.accentColor,
    renderAssetSignature,
  ].join("|");
}

function renderFurnitureSprite(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  renderAsset: OfficeSceneFurnitureRenderAsset,
  width: number,
  height: number,
): void {
  const { atlasFrame, atlasKey } = renderAsset;
  const sprite = scene.add.image(
    width / 2,
    height / 2,
    DONARG_OFFICE_FURNITURE_ATLAS_KEY,
    atlasKey,
  );
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
  // South-edge world-pixel Y so preview-scene characters y-sort consistently
  // with walls and furniture.
  container.setDepth(worldOffsetY + (actor.row + 1) * cellSize);

  const target: OfficeRenderableTarget = {
    kind: "character",
    id: actor.id,
    label: actor.label,
    bounds: new Phaser.Geom.Rectangle(
      x + worldOffsetX,
      y + worldOffsetY,
      cellSize,
      cellSize,
    ),
  };

  return { target, container };
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
  if (isWall(col, row - 1)) mask |= 1;
  if (isWall(col + 1, row)) mask |= 2;
  if (isWall(col, row + 1)) mask |= 4;
  if (isWall(col - 1, row)) mask |= 8;
  return mask;
}

function shortenLabel(label: string, max: number): string {
  if (label.length <= max) return label;
  if (max <= 1) return label.slice(0, max);
  return `${label.slice(0, max - 1)}…`;
}
