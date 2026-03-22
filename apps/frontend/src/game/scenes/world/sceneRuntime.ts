import type Phaser from "phaser";
import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { EntityRegistry } from "../../domain/entityRegistry";
import type {
  OfficeFloorMode,
  OfficeSetEditorToolPayload,
  SelectedTerrainToolPayload,
} from "../../events";
import type { TerrainSystem } from "../../terrain";
import type { OfficeLayoutRenderable } from "../../scenes/office/render";
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

export function cloneOfficeEditorToolPayload(
  payload: OfficeSetEditorToolPayload,
): OfficeSetEditorToolPayload {
  switch (payload.tool) {
    case "floor":
      return {
        tool: "floor",
        floorMode: payload.floorMode,
        tileColor: payload.tileColor,
        floorColor: payload.floorColor,
        floorPattern: payload.floorPattern,
      };
    case "furniture":
      return {
        tool: "furniture",
        furnitureId: payload.furnitureId,
      };
    case "wall":
    case "erase":
      return { tool: payload.tool };
    default:
      return { tool: null };
  }
}

export function getOfficeEditorTool(
  payload: OfficeSetEditorToolPayload,
): OfficeSetEditorToolPayload["tool"] {
  return payload.tool;
}

export function getOfficeFloorMode(payload: OfficeSetEditorToolPayload): OfficeFloorMode {
  return payload.tool === "floor" ? payload.floorMode : "paint";
}

export function getOfficeTileColor(payload: OfficeSetEditorToolPayload): OfficeTileColor | null {
  return payload.tool === "floor" ? payload.tileColor : null;
}

export function getOfficeFloorColor(payload: OfficeSetEditorToolPayload): OfficeColorAdjust | null {
  return payload.tool === "floor" ? payload.floorColor : null;
}

export function getOfficeFloorPattern(payload: OfficeSetEditorToolPayload): string | null {
  return payload.tool === "floor" ? payload.floorPattern : null;
}

export function getOfficeFurnitureId(payload: OfficeSetEditorToolPayload): string | null {
  return payload.tool === "furniture" ? payload.furnitureId : null;
}

export function setOfficeFloorMode(
  payload: OfficeSetEditorToolPayload,
  floorMode: OfficeFloorMode,
): OfficeSetEditorToolPayload {
  return payload.tool === "floor" ? { ...payload, floorMode } : payload;
}

// Review: WorldSceneRuntime is a "bag of state" anti-pattern. It conflates at least
// three unrelated concerns into a single class with no internal encapsulation:
//
//   1. Subsystem references (catalog, entityRegistry, terrainSystem, navigation,
//      officeRenderable, officeRegion) — these are dependency-injection slots that
//      should be constructor parameters on the scene or owned by a DI container.
//
//   2. Visual feedback game objects (selectionBadge, terrainBrushPreview,
//      officeCellHighlight, terrainBrushRenderPreviewImages) — these are Phaser
//      game objects that belong to a SceneFeedbackLayer class. Storing them in a
//      shared runtime bag means any method in the scene can mutate them directly,
//      with no ownership boundary.
//
//   3. Editor tool state (officeEditorToolPayload plus derived selectors) — the
//      runtime stores the raw editor payload and derives tool-specific values from
//      it instead of mirroring six separate fields.
//
//   4. Input / interaction state (isPanning, panStartX/Y, camStartX/Y, wasd,
//      shiftKey, terrainPaintSession, isOfficePainting, officeDirty,
//      activeTerrainTool) — this is transient runtime state for in-progress gestures
//      and should be scoped to the relevant input handler, not a shared global bag.
//
// All public fields being mutable with no accessors means there are zero invariants
// enforced and zero way to trace who last changed a field at runtime.
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
  public officeEditorToolPayload: OfficeSetEditorToolPayload = { tool: null };
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
    this.officeEditorToolPayload = { tool: null };
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
