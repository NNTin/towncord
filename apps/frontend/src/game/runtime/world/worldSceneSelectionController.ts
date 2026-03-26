import type Phaser from "phaser";
import type { TerrainRuntime } from "../../../engine";
import type { TerrainTileInspectedPayload } from "../../contracts/runtime";
import type { WorldSelectableActor, WorldEntity } from "./types";
import { EntitySystem } from "./entitySystem";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";
import { RENDER_LAYERS } from "../../renderLayers";

const SELECTED_BADGE_ANIMATION_KEY = "props.bloomseed.static.rocks.variant-03";
const SELECTED_BADGE_SCALE = 0.5;
const SELECTED_BADGE_VERTICAL_OFFSET = 3;

type WorldSceneSelectionControllerHost = {
  scene: Pick<Phaser.Scene, "add" | "anims" | "input" | "cameras">;
  getEntitySystem: () => EntitySystem | null;
  getTerrainRuntime: () => TerrainRuntime | null;
};

export class WorldSceneSelectionController {
  private selectionBadge: Phaser.GameObjects.Sprite | null = null;

  constructor(
    private readonly host: WorldSceneSelectionControllerHost,
    private readonly projections: WorldSceneProjectionEmitter,
  ) {}

  public createSelectionBadge(): void {
    const firstFrame = this.host.scene.anims
      .get(SELECTED_BADGE_ANIMATION_KEY)
      ?.frames[0];
    if (!firstFrame) {
      return;
    }

    const badge = this.host.scene.add.sprite(
      0,
      0,
      firstFrame.textureKey,
      firstFrame.textureFrame,
    );
    badge.setScale(SELECTED_BADGE_SCALE);
    badge.setDepth(RENDER_LAYERS.UI_OVERLAY);
    badge.setVisible(false);
    this.selectionBadge = badge;
  }

  public dispose(): void {
    this.selectionBadge?.destroy();
    this.selectionBadge = null;
  }

  public selectEntity(entity: WorldEntity | null): void {
    const entitySystem = this.host.getEntitySystem();
    if (!entitySystem || entitySystem.getSelected() === entity) {
      return;
    }

    entitySystem.select(entity);
    this.setSelectionBadgeVisible(Boolean(entity));
    if (entity) {
      this.syncSelectionBadgePosition(entity);
    }
  }

  public handleSelectionAndInspect(pointer: Phaser.Input.Pointer): void {
    let hit: WorldEntity | null = null;
    const entitySystem = this.host.getEntitySystem();
    const hits = this.host.scene.input.sortGameObjects(
      this.host.scene.input.hitTestPointer(pointer),
      pointer,
    );

    for (const target of hits) {
      const entity = entitySystem?.findBySpriteTarget(target) ?? null;
      if (entity) {
        hit = entity;
        break;
      }
    }

    this.selectEntity(hit);

    const terrainRuntime = this.host.getTerrainRuntime();
    if (!terrainRuntime) {
      return;
    }

    const worldPoint = this.host.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const inspected = terrainRuntime.inspectAtWorld(worldPoint.x, worldPoint.y);
    if (inspected) {
      const payload: TerrainTileInspectedPayload = inspected;
      this.projections.emitTerrainTileInspected(payload);
    }
  }

  public syncSelectionBadgePosition(entity: WorldSelectableActor): void {
    if (!this.selectionBadge) {
      return;
    }

    this.selectionBadge.setPosition(
      entity.position.x,
      entity.position.y -
        entity.sprite.displayHeight * EntitySystem.spriteOriginY -
        SELECTED_BADGE_VERTICAL_OFFSET,
    );
  }

  private setSelectionBadgeVisible(visible: boolean): void {
    this.selectionBadge?.setVisible(visible);
  }
}
