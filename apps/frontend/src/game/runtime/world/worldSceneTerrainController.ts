import type Phaser from "phaser";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  type TerrainCellCoord,
  type TerrainRenderTile,
  type TerrainRuntime,
} from "../../../engine";
import type { TerrainContentSourceId } from "../../content/asset-catalog/terrainContentRepository";
import type {
  PlaceTerrainDropPayload,
  SelectedTerrainToolPayload,
} from "../../contracts/runtime";
import type { WorldEntity } from "./types";
import { TerrainPaintSession } from "./terrainPaintSession";
import { RENDER_LAYERS } from "../../renderLayers";

const TERRAIN_BRUSH_PREVIEW_ALPHA = 0.18;
const TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH = 2;
const TERRAIN_BRUSH_PREVIEW_READY_FILL = 0x38bdf8;
const TERRAIN_BRUSH_PREVIEW_READY_STROKE = 0xe0f2fe;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA = 0.72;

type WorldSceneTerrainControllerHost = {
  scene: Pick<Phaser.Scene, "add" | "cameras" | "input">;
  getTerrainRuntime: () => TerrainRuntime | null;
  getEntities: () => readonly WorldEntity[];
  setTerrainContentSource: (sourceId: TerrainContentSourceId) => void;
};

type Destroyable = {
  destroy?: () => unknown;
};

function destroyGameObject(object: Destroyable | null | undefined): void {
  object?.destroy?.();
}

function destroyGameObjects(
  objects: readonly (Destroyable | null | undefined)[],
): void {
  for (const object of objects) {
    destroyGameObject(object);
  }
}

export class WorldSceneTerrainController {
  private activeTerrainTool: SelectedTerrainToolPayload = null;
  private readonly terrainPaintSession = new TerrainPaintSession();
  private terrainBrushPreview: Phaser.GameObjects.Rectangle | null = null;
  private terrainBrushRenderPreviewImages: Phaser.GameObjects.Image[] = [];

  constructor(private readonly host: WorldSceneTerrainControllerHost) {}

  public createBrushPreview(): void {
    const preview = this.host.scene.add.rectangle(
      0,
      0,
      TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_BRUSH_PREVIEW_READY_FILL,
      TERRAIN_BRUSH_PREVIEW_ALPHA,
    );
    preview.setOrigin(0, 0);
    preview.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW);
    preview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    preview.setVisible(false);
    this.terrainBrushPreview = preview;
  }

  public hasActiveTool(): boolean {
    return Boolean(this.activeTerrainTool);
  }

  public beginPainting(pointer: Phaser.Input.Pointer): void {
    this.terrainPaintSession.begin();
    this.syncPreviewFromPointer(pointer);
    this.paintAtScreen(pointer.x, pointer.y);
  }

  public shouldContinuePainting(): boolean {
    return Boolean(
      this.activeTerrainTool && this.terrainPaintSession.isActive(),
    );
  }

  public continuePainting(pointer: Phaser.Input.Pointer): void {
    this.paintAtScreen(pointer.x, pointer.y);
  }

  public endPainting(): void {
    this.terrainPaintSession.end();
  }

  public handlePlaceTerrainDrop(payload: PlaceTerrainDropPayload): void {
    const terrainRuntime = this.host.getTerrainRuntime();
    if (!terrainRuntime) {
      return;
    }

    const worldPoint = this.host.scene.cameras.main.getWorldPoint(
      payload.screenX,
      payload.screenY,
    );
    this.queueTerrainDropAtWorld(payload, worldPoint.x, worldPoint.y);
  }

  public handleSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    if (payload?.terrainSourceId) {
      this.host.setTerrainContentSource(payload.terrainSourceId);
    }

    this.activeTerrainTool = payload;
    this.terrainPaintSession.end();
    this.syncPreviewFromPointer(this.host.scene.input.activePointer);
  }

  public syncPreviewFromPointer(pointer: Phaser.Input.Pointer | null): void {
    if (!pointer) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const isWithinGame =
      !("withinGame" in pointer) ||
      Boolean(
        (pointer as Phaser.Input.Pointer & { withinGame?: boolean }).withinGame,
      );

    if (!isWithinGame) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    this.syncPreviewAtScreen(pointer.x, pointer.y);
  }

  public syncPreviewAtScreen(screenX: number, screenY: number): void {
    if (
      !this.activeTerrainTool ||
      !this.host.getTerrainRuntime() ||
      !this.terrainBrushPreview
    ) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const terrainRuntime = this.host.getTerrainRuntime();
    if (!terrainRuntime) {
      return;
    }

    const worldPoint = this.host.scene.cameras.main.getWorldPoint(
      screenX,
      screenY,
    );
    const grid = terrainRuntime.getGameplayGrid();
    const cell = grid.worldToCell(worldPoint.x, worldPoint.y);
    if (!cell) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const isBlocked = this.isTerrainCellOccupied(cell);
    this.terrainBrushPreview.setFillStyle(
      isBlocked
        ? TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL
        : TERRAIN_BRUSH_PREVIEW_READY_FILL,
      TERRAIN_BRUSH_PREVIEW_ALPHA,
    );
    this.terrainBrushPreview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      isBlocked
        ? TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE
        : TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    this.terrainBrushPreview.setPosition(
      cell.cellX * TERRAIN_CELL_WORLD_SIZE,
      cell.cellY * TERRAIN_CELL_WORLD_SIZE,
    );
    this.terrainBrushPreview.setVisible(true);

    if (isBlocked) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const previewTiles = terrainRuntime.previewPaintAtWorld(
      {
        type: "terrain",
        materialId: this.activeTerrainTool.materialId,
        brushId: this.activeTerrainTool.brushId,
        screenX,
        screenY,
      },
      worldPoint.x,
      worldPoint.y,
    );
    if (!previewTiles || previewTiles.length === 0) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    this.syncRenderPreviewTiles(previewTiles);
  }

  public syncRenderPreviewTiles(tiles: readonly TerrainRenderTile[]): void {
    const terrainRuntime = this.host.getTerrainRuntime();
    const textureKey = terrainRuntime?.getTextureKey();
    if (!textureKey) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    tiles.forEach((tile, index) => {
      const image = this.getTerrainBrushRenderPreviewImage(index);
      image.setTexture(textureKey, tile.frame);
      image.setScale(TERRAIN_CELL_WORLD_SIZE / image.width);
      image.setRotation(tile.rotate90 * (Math.PI / 2));
      image.setFlip(tile.flipX, tile.flipY);
      image.setPosition(
        tile.cellX * TERRAIN_CELL_WORLD_SIZE +
          TERRAIN_CELL_WORLD_SIZE * 0.5 +
          TERRAIN_RENDER_GRID_WORLD_OFFSET,
        tile.cellY * TERRAIN_CELL_WORLD_SIZE +
          TERRAIN_CELL_WORLD_SIZE * 0.5 +
          TERRAIN_RENDER_GRID_WORLD_OFFSET,
      );
      image.setVisible(true);
    });

    for (
      let index = tiles.length;
      index < this.terrainBrushRenderPreviewImages.length;
      index += 1
    ) {
      this.terrainBrushRenderPreviewImages[index]?.setVisible(false);
    }
  }

  public paintAtScreen(screenX: number, screenY: number): void {
    const terrainRuntime = this.host.getTerrainRuntime();
    if (!this.activeTerrainTool || !terrainRuntime) {
      return;
    }

    const worldPoint = this.host.scene.cameras.main.getWorldPoint(
      screenX,
      screenY,
    );
    const cell = terrainRuntime
      .getGameplayGrid()
      .worldToCell(worldPoint.x, worldPoint.y);
    if (
      !cell ||
      this.isTerrainCellOccupied(cell) ||
      !this.terrainPaintSession.shouldPaintCell(cell)
    ) {
      return;
    }

    this.queueTerrainDropAtWorld(
      {
        type: "terrain",
        materialId: this.activeTerrainTool.materialId,
        brushId: this.activeTerrainTool.brushId,
        screenX,
        screenY,
      },
      worldPoint.x,
      worldPoint.y,
    );
  }

  public dispose(): void {
    destroyGameObject(this.terrainBrushPreview);
    destroyGameObjects(this.terrainBrushRenderPreviewImages);
    this.terrainBrushPreview = null;
    this.terrainBrushRenderPreviewImages = [];
    this.activeTerrainTool = null;
    this.terrainPaintSession.reset();
  }

  private setTerrainBrushPreviewVisible(visible: boolean): void {
    this.terrainBrushPreview?.setVisible(visible);
  }

  private hideTerrainBrushRenderPreview(): void {
    for (const image of this.terrainBrushRenderPreviewImages) {
      image.setVisible(false);
    }
  }

  private getTerrainBrushRenderPreviewImage(
    index: number,
  ): Phaser.GameObjects.Image {
    const existing = this.terrainBrushRenderPreviewImages[index];
    if (existing) {
      return existing;
    }

    const image = this.host.scene.add.image(
      0,
      0,
      this.host.getTerrainRuntime()?.getTextureKey() ?? "debug.tilesets",
    );
    image.setAlpha(TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA);
    image.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW - 1);
    image.setVisible(false);
    this.terrainBrushRenderPreviewImages[index] = image;
    return image;
  }

  private queueTerrainDropAtWorld(
    payload: PlaceTerrainDropPayload,
    worldX: number,
    worldY: number,
  ): void {
    const terrainRuntime = this.host.getTerrainRuntime();
    if (!terrainRuntime) {
      return;
    }

    const cell = terrainRuntime.getGameplayGrid().worldToCell(worldX, worldY);
    if (!cell || this.isTerrainCellOccupied(cell)) {
      return;
    }

    terrainRuntime.queueDrop(payload, worldX, worldY);
  }

  private isTerrainCellOccupied(cell: TerrainCellCoord): boolean {
    const terrainRuntime = this.host.getTerrainRuntime();
    if (!terrainRuntime) {
      return false;
    }

    const grid = terrainRuntime.getGameplayGrid();
    return this.host.getEntities().some((entity) => {
      const entityCell = grid.worldToCell(entity.position.x, entity.position.y);
      return (
        entityCell?.cellX === cell.cellX && entityCell?.cellY === cell.cellY
      );
    });
  }
}
