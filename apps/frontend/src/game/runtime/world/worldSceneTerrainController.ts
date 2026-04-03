import type Phaser from "phaser";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_TEXTURE_KEY,
  worldToAnchoredGridCell,
  type AnchoredGridRegion,
  type TerrainCellCoord,
  type TerrainRenderTile,
  type TerrainRuntime,
} from "../../../engine";
import type { OfficeSceneLayout } from "../../contracts/office-scene";
import {
  resolveFarmrpgStaticTerrainSourceSpec,
  type FarmrpgStaticTerrainSourceSpec,
} from "../../content/asset-catalog/farmrpgTerrainSourceCatalog";
import type { TerrainContentSourceId } from "../../content/asset-catalog/terrainContentRepository";
import type {
  PlaceTerrainDropPayload,
  SelectedTerrainToolPayload,
} from "../../contracts/runtime";
import type { WorldEntity } from "./types";
import { TerrainPaintSession } from "./terrainPaintSession";
import { RENDER_LAYERS } from "../../renderLayers";
import { TERRAIN_DETAIL_EMPTY_SOURCE_ID } from "../../terrain/runtime";

const TERRAIN_BRUSH_PREVIEW_ALPHA = 0.18;
const TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH = 2;
const TERRAIN_BRUSH_PREVIEW_READY_FILL = 0x38bdf8;
const TERRAIN_BRUSH_PREVIEW_READY_STROKE = 0xe0f2fe;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA = 0.72;

type OfficeRegion = AnchoredGridRegion<OfficeSceneLayout>;

type WorldSceneTerrainControllerHost = {
  scene: Pick<Phaser.Scene, "add" | "cameras" | "input">;
  getTerrainRuntime: () => TerrainRuntime | null;
  getTerrainDetailRuntime: () => TerrainRuntime | null;
  getOfficeDetailRuntime: () => TerrainRuntime | null;
  getOfficeRegion: () => OfficeRegion | null;
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
    if (this.isDeleteTerrainTool()) {
      this.queueDeleteDropAtWorld(
        payload.screenX,
        payload.screenY,
        worldPoint.x,
        worldPoint.y,
      );
      return;
    }

    const staticSourceSpec = this.resolveActiveStaticTerrainSourceSpec();
    if (staticSourceSpec) {
      this.queueStaticTerrainDropAtWorld(
        staticSourceSpec,
        payload.screenX,
        payload.screenY,
        worldPoint.x,
        worldPoint.y,
      );
      return;
    }

    this.queueTerrainDropAtWorld(payload, worldPoint.x, worldPoint.y);
  }

  public handleSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    if (
      payload?.terrainSourceId &&
      !resolveFarmrpgStaticTerrainSourceSpec(payload.terrainSourceId)
    ) {
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

    const staticSourceSpec = this.resolveActiveStaticTerrainSourceSpec();
    const isBlocked =
      this.isTerrainCellOccupied(cell) ||
      (staticSourceSpec
        ? this.isStaticTerrainSourceBlockedAtWorld(
            staticSourceSpec,
            worldPoint.x,
            worldPoint.y,
          )
        : false);
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

    const previewRuntime =
      staticSourceSpec?.placementDomain === "office"
        ? this.host.getOfficeDetailRuntime()
        : staticSourceSpec
          ? this.host.getTerrainDetailRuntime()
          : terrainRuntime;
    const previewPayload = staticSourceSpec
      ? this.buildStaticTerrainDropPayload(
          staticSourceSpec.sourceId,
          screenX,
          screenY,
        )
      : this.isDeleteTerrainTool() &&
          this.isInsideOfficeRegion(worldPoint.x, worldPoint.y)
        ? null
        : {
            type: "terrain" as const,
            materialId: this.activeTerrainTool.materialId,
            brushId: this.activeTerrainTool.brushId,
            screenX,
            screenY,
          };
    const previewTiles =
      previewRuntime && previewPayload
        ? previewRuntime.previewPaintAtWorld(
            previewPayload,
            worldPoint.x,
            worldPoint.y,
          )
        : null;
    if (!previewTiles || previewTiles.length === 0) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    this.syncRenderPreviewTiles(previewTiles, previewRuntime?.getTextureKey());
  }

  public syncRenderPreviewTiles(
    tiles: readonly TerrainRenderTile[],
    textureKey: string | undefined = this.host
      .getTerrainRuntime()
      ?.getTextureKey(),
  ): void {
    if (!textureKey) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    let previewIndex = 0;
    tiles.forEach((tile) => {
      if (tile.underlayFrame) {
        const underlayImage =
          this.getTerrainBrushRenderPreviewImage(previewIndex);
        underlayImage.setTexture(textureKey, tile.underlayFrame);
        underlayImage.setScale(TERRAIN_CELL_WORLD_SIZE / underlayImage.width);
        underlayImage.setRotation(0);
        underlayImage.setFlip(false, false);
        underlayImage.setPosition(
          tile.cellX * TERRAIN_CELL_WORLD_SIZE +
            TERRAIN_CELL_WORLD_SIZE * 0.5 +
            TERRAIN_RENDER_GRID_WORLD_OFFSET,
          tile.cellY * TERRAIN_CELL_WORLD_SIZE +
            TERRAIN_CELL_WORLD_SIZE * 0.5 +
            TERRAIN_RENDER_GRID_WORLD_OFFSET,
        );
        underlayImage.setVisible(true);
        previewIndex += 1;
      }

      const index = previewIndex;
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
      previewIndex += 1;
    });

    for (
      let index = previewIndex;
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

    if (this.isDeleteTerrainTool()) {
      this.queueDeleteDropAtWorld(screenX, screenY, worldPoint.x, worldPoint.y);
      return;
    }

    const staticSourceSpec = this.resolveActiveStaticTerrainSourceSpec();
    if (staticSourceSpec) {
      this.queueStaticTerrainDropAtWorld(
        staticSourceSpec,
        screenX,
        screenY,
        worldPoint.x,
        worldPoint.y,
      );
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
      this.host.getTerrainRuntime()?.getTextureKey() ?? TERRAIN_TEXTURE_KEY,
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

  private queueStaticTerrainDropAtWorld(
    sourceSpec: FarmrpgStaticTerrainSourceSpec,
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number,
  ): void {
    if (this.isStaticTerrainSourceBlockedAtWorld(sourceSpec, worldX, worldY)) {
      return;
    }

    const targetRuntime =
      sourceSpec.placementDomain === "office"
        ? this.host.getOfficeDetailRuntime()
        : this.host.getTerrainDetailRuntime();
    if (!targetRuntime) {
      return;
    }

    const cell = targetRuntime.getGameplayGrid().worldToCell(worldX, worldY);
    if (!cell || this.isTerrainCellOccupied(cell)) {
      return;
    }

    targetRuntime.queueDrop(
      this.buildStaticTerrainDropPayload(sourceSpec.sourceId, screenX, screenY),
      worldX,
      worldY,
    );
  }

  private queueDeleteDropAtWorld(
    screenX: number,
    screenY: number,
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

    const insideOffice = this.isInsideOfficeRegion(worldX, worldY);
    const detailRuntime = insideOffice
      ? this.host.getOfficeDetailRuntime()
      : this.host.getTerrainDetailRuntime();
    detailRuntime?.queueDrop(
      this.buildStaticTerrainDropPayload(
        TERRAIN_DETAIL_EMPTY_SOURCE_ID,
        screenX,
        screenY,
        "delete",
      ),
      worldX,
      worldY,
    );

    if (!insideOffice) {
      terrainRuntime.queueDrop(
        {
          type: "terrain",
          materialId: this.activeTerrainTool?.materialId ?? "ground",
          brushId: "delete",
          screenX,
          screenY,
        },
        worldX,
        worldY,
      );
    }
  }

  private buildStaticTerrainDropPayload(
    sourceId: string,
    screenX: number,
    screenY: number,
    brushId: string = sourceId,
  ): PlaceTerrainDropPayload {
    return {
      type: "terrain",
      materialId: sourceId,
      brushId,
      screenX,
      screenY,
    };
  }

  private resolveActiveStaticTerrainSourceSpec(): FarmrpgStaticTerrainSourceSpec | null {
    return resolveFarmrpgStaticTerrainSourceSpec(
      this.activeTerrainTool?.terrainSourceId,
    );
  }

  private isDeleteTerrainTool(): boolean {
    return this.activeTerrainTool?.brushId === "delete";
  }

  private isInsideOfficeRegion(worldX: number, worldY: number): boolean {
    const officeRegion = this.host.getOfficeRegion();
    if (!officeRegion) {
      return false;
    }

    return Boolean(worldToAnchoredGridCell(worldX, worldY, officeRegion));
  }

  private isStaticTerrainSourceBlockedAtWorld(
    sourceSpec: FarmrpgStaticTerrainSourceSpec,
    worldX: number,
    worldY: number,
  ): boolean {
    const insideOffice = this.isInsideOfficeRegion(worldX, worldY);
    return sourceSpec.placementDomain === "office"
      ? !insideOffice
      : insideOffice;
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
