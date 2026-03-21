import type Phaser from "phaser";
import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { EntityRegistry } from "../../domain/entityRegistry";
import type { OfficeFloorMode, SelectedTerrainToolPayload } from "../../events";
import type { TerrainSystem } from "../../terrain";
import type { OfficeLayoutRenderable } from "../../scenes/office/render";
import type { OfficeEditorToolId } from "../../events";
import type { OfficeTileColor } from "../../office/model";
import type { TownOfficeRegion } from "../../town/layout";
import type { WorldNavigationService } from "./navigation";
import { TerrainPaintSession } from "./terrainPaintSession";
import type { OfficeColorAdjust } from "../../scenes/office/colors";

export type WorldSceneMovementKeys = Record<
  "W" | "A" | "S" | "D",
  Phaser.Input.Keyboard.Key
>;

type Destroyable = {
  destroy?: () => unknown;
};

function destroyGameObject(object: Destroyable | null | undefined): void {
  if (!object) {
    return;
  }

  object.destroy?.();
}

function destroyGameObjects(objects: readonly (Destroyable | null | undefined)[]): void {
  for (const object of objects) {
    destroyGameObject(object);
  }
}

export class WorldSceneRuntime {
  public catalog: AnimationCatalog | null = null;
  public entityRegistry: EntityRegistry | null = null;

  public selectionBadge: Phaser.GameObjects.Sprite | null = null;
  public terrainBrushPreview: Phaser.GameObjects.Rectangle | null = null;
  public officeCellHighlight: Phaser.GameObjects.Rectangle | null = null;
  public terrainBrushRenderPreviewImages: Phaser.GameObjects.Image[] = [];
  public terrainSystem: TerrainSystem | null = null;
  public navigation: WorldNavigationService | null = null;
  public officeRenderable: OfficeLayoutRenderable | null = null;
  public officeRegion: TownOfficeRegion | null = null;
  public activeOfficeTool: OfficeEditorToolId | null = null;
  public activeFloorMode: OfficeFloorMode = "paint";
  public activeTileColor: OfficeTileColor | null = null;
  public activeFloorColor: OfficeColorAdjust | null = null;
  public activeFloorPattern: string | null = null;
  public activeFurnitureId: string | null = null;
  public isOfficePainting = false;
  public officeDirty = false;

  public wasd: WorldSceneMovementKeys | null = null;
  public shiftKey: Phaser.Input.Keyboard.Key | null = null;
  public activeTerrainTool: SelectedTerrainToolPayload = null;
  public terrainPaintSession: TerrainPaintSession = new TerrainPaintSession();

  public isPanning = false;
  public panStartX = 0;
  public panStartY = 0;
  public camStartX = 0;
  public camStartY = 0;
  public lastPerfEmitAtMs = 0;

  private reset(): void {
    this.catalog = null;
    this.entityRegistry = null;

    this.selectionBadge = null;
    this.terrainBrushPreview = null;
    this.officeCellHighlight = null;
    this.terrainBrushRenderPreviewImages = [];
    this.terrainSystem = null;
    this.navigation = null;
    this.officeRenderable = null;
    this.officeRegion = null;
    this.activeOfficeTool = null;
    this.activeFloorMode = "paint";
    this.activeTileColor = null;
    this.activeFloorColor = null;
    this.activeFloorPattern = null;
    this.activeFurnitureId = null;
    this.isOfficePainting = false;
    this.officeDirty = false;

    this.wasd = null;
    this.shiftKey = null;
    this.activeTerrainTool = null;
    this.terrainPaintSession.reset();

    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.camStartX = 0;
    this.camStartY = 0;
    this.lastPerfEmitAtMs = 0;
  }

  public dispose(): void {
    this.terrainSystem?.destroy();
    this.officeRenderable?.destroy();
    destroyGameObject(this.selectionBadge);
    destroyGameObject(this.terrainBrushPreview);
    destroyGameObject(this.officeCellHighlight);
    destroyGameObjects(this.terrainBrushRenderPreviewImages);
    this.reset();
  }
}
