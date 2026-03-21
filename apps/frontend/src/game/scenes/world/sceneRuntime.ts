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
import type { WorldEntity } from "./types";
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

// Review: One Way Data Flow / Separation of Concerns — WorldSceneRuntime holds
// `entities`, `selectedEntity`, `nextId`, and `directInputIdleMs`, but these
// same fields are independently owned by EntitySystem (entitySystem.ts:39-42).
// This creates two sources of truth for entity state. WorldScene reads from
// runtimeState (via getters) while EntitySystem manages its own copies.
//
// The root issue is that WorldSceneRuntime was designed as a bag-of-all-state
// before systems were extracted. Now that EntitySystem, OfficeEditorSystem, and
// TerrainSystem each own their own state, the corresponding fields here are
// either dead weight or a back-channel that test harnesses exploit (see the
// isTerrainCellOccupied dual-source pattern in WorldScene.ts).
//
// Recommended: remove entity-owned fields from WorldSceneRuntime. Let each
// system (EntitySystem, a future OfficePaintSession, CameraController) own its
// slice of state. WorldSceneRuntime should shrink to only the fields that don't
// belong to any system (wasd keys, terrain paint session, etc.) — or disappear
// entirely once all state is system-owned.
export class WorldSceneRuntime {
  public catalog: AnimationCatalog | null = null;
  public entityRegistry: EntityRegistry | null = null;

  public entities: WorldEntity[] = [];
  public selectedEntity: WorldEntity | null = null;
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
    destroyGameObject(this.officeCellHighlight);
    destroyGameObjects(this.terrainBrushRenderPreviewImages);
    this.reset();
  }
}
