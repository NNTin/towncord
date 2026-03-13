import Phaser from "phaser";
import type {
  OfficeSceneCharacter,
  OfficeSceneFurniture,
  OfficeSceneLayout,
} from "./bootstrap";
import { resolveOfficeTileFill } from "./colors";

const GRID_LINE_COLOR = 0x0f172a;
const VOID_TILE_COLOR = 0x020617;
const FLOOR_INSET_ALPHA = 0.18;
const WALL_INSET_ALPHA = 0.28;
const SHADOW_COLOR = 0x020617;
const LABEL_TEXT_COLOR = "#f8fafc";
const CHARACTER_LABEL_TEXT_COLOR = "#0f172a";

export type OfficeRenderableTargetKind = "furniture" | "character";

export type OfficeRenderableTarget = {
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

export function renderOfficeLayout(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
): OfficeLayoutRenderable {
  const tilesGraphics = renderTiles(scene, layout);

  const furnitureEntries = layout.furniture.map((item) => {
    const { target, container } = renderFurniture(scene, layout, item);
    return { target, container };
  });

  const characterEntries = layout.characters.map((actor) => {
    const { target, container } = renderCharacter(scene, layout, actor);
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

function renderTiles(scene: Phaser.Scene, layout: OfficeSceneLayout): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
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
): { target: OfficeRenderableTarget; container: Phaser.GameObjects.Container } {
  const x = item.col * layout.cellSize;
  const y = item.row * layout.cellSize;
  const width = item.width * layout.cellSize;
  const height = item.height * layout.cellSize;
  const container = scene.add.container(x, y);
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
  container.setDepth(resolveRenderableDepth(item.row + item.height, item.placement === "wall" ? 6 : 18));

  const target: OfficeRenderableTarget = {
    kind: "furniture",
    id: item.id,
    label: item.label,
    bounds: new Phaser.Geom.Rectangle(x, y, width, height),
  };

  return { target, container };
}

function renderCharacter(
  scene: Phaser.Scene,
  layout: OfficeSceneLayout,
  actor: OfficeSceneCharacter,
): { target: OfficeRenderableTarget; container: Phaser.GameObjects.Container } {
  const cellSize = layout.cellSize;
  const x = actor.col * cellSize;
  const y = actor.row * cellSize;
  const container = scene.add.container(x, y);
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
  container.setDepth(resolveRenderableDepth(actor.row + 1, 34));

  const target: OfficeRenderableTarget = {
    kind: "character",
    id: actor.id,
    label: actor.label,
    bounds: new Phaser.Geom.Rectangle(x, y, cellSize, cellSize),
  };

  return { target, container };
}

function resolveRenderableDepth(bottomRow: number, layer: number): number {
  return bottomRow * 100 + layer;
}

function shortenLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(1, maxLength - 3))}...`;
}
