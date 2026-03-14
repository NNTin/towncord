import type Phaser from "phaser";
import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { EntityRegistry } from "../../domain/entityRegistry";
import type { SelectedTerrainToolPayload } from "../../events";
import type { TerrainSystem } from "../../terrain";
import type { OfficeLayoutRenderable } from "../../scenes/office/render";
import type { OfficeEditorToolId } from "../../events";
import type { TownOfficeRegion } from "../../town/layout";
import type { WorldNavigationService } from "./navigation";
import { TerrainPaintSession } from "./terrainPaintSession";
import type { WorldEntity } from "./types";

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

  public entities: WorldEntity[] = [];
  public selectedEntity: WorldEntity | null = null;
  public selectionBadge: Phaser.GameObjects.Sprite | null = null;
  public terrainBrushPreview: Phaser.GameObjects.Rectangle | null = null;
  public terrainBrushRenderPreviewImages: Phaser.GameObjects.Image[] = [];
  public terrainSystem: TerrainSystem | null = null;
  public navigation: WorldNavigationService | null = null;
  public officeRenderable: OfficeLayoutRenderable | null = null;
  public officeRegion: TownOfficeRegion | null = null;
  public activeOfficeTool: OfficeEditorToolId | null = null;
  public activeTileColor = "neutral";
  public activeFurnitureId: string | null = null;
  public isOfficePainting = false;
  public officeDirty = false;
  public nextId = 0;

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
  public directInputIdleMs = 0;

  private reset(): void {
    this.catalog = null;
    this.entityRegistry = null;

    this.entities = [];
    this.selectedEntity = null;
    this.selectionBadge = null;
    this.terrainBrushPreview = null;
    this.terrainBrushRenderPreviewImages = [];
    this.terrainSystem = null;
    this.navigation = null;
    this.officeRenderable = null;
    this.officeRegion = null;
    this.activeOfficeTool = null;
    this.activeTileColor = "neutral";
    this.activeFurnitureId = null;
    this.isOfficePainting = false;
    this.officeDirty = false;
    this.nextId = 0;

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
    this.directInputIdleMs = 0;
  }

  public dispose(): void {
    this.terrainSystem?.destroy();
    this.officeRenderable?.destroy();
    destroyGameObjects(this.entities.map((entity) => entity.sprite));
    destroyGameObject(this.selectionBadge);
    destroyGameObject(this.terrainBrushPreview);
    destroyGameObjects(this.terrainBrushRenderPreviewImages);
    this.reset();
  }
}
