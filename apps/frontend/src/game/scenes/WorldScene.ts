import Phaser from "phaser";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import {
  type AnimationCatalog,
  buildAnimationCatalog,
} from "../assets/animationCatalog";
import { CatalogEntityRegistry } from "../domain/entityRegistry";
import {
  PLACE_OBJECT_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  PLAYER_STATE_CHANGED_EVENT,
  type PlaceObjectDropPayload,
  type PlayerPlacedPayload,
  type PlayerStateChangedPayload,
} from "../events";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";
import { playEntityAnimation } from "./world/animationSystem";
import { createWorldEntity } from "./world/entityFactory";
import { updateEntityMovement } from "./world/movementSystem";
import type { WorldEntity } from "./world/types";

export const WORLD_SCENE_KEY = "world";

const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const SELECTED_TINT = 0x88bbff;

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;
  private entityRegistry: CatalogEntityRegistry | null = null;

  private entities: WorldEntity[] = [];
  private selectedEntity: WorldEntity | null = null;
  private nextId = 0;

  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  constructor() {
    super(WORLD_SCENE_KEY);
  }

  public create(): void {
    const rawKeys = this.registry.get(BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY) as unknown;
    const animationKeys = Array.isArray(rawKeys)
      ? rawKeys.filter((value): value is string => typeof value === "string")
      : [];

    if (animationKeys.length > 0) {
      this.catalog = buildAnimationCatalog(animationKeys);
      this.entityRegistry = CatalogEntityRegistry.fromCatalog(this.catalog);
    }

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);

    this.game.events.on(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.events.once(
      "shutdown",
      () => {
        this.game.events.off(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
        this.input.off("pointerdown", this.onPointerDown, this);
        this.input.off("pointermove", this.onPointerMove, this);
        this.input.off("pointerup", this.onPointerUp, this);
        this.input.off("wheel", this.onWheel, this);
      },
      this,
    );
  }

  public override update(_time: number, delta: number): void {
    if (!this.selectedEntity || !this.wasd || !this.shiftKey || !this.catalog) {
      return;
    }

    const entity = this.selectedEntity;
    const dt = delta / 1000;

    const prevState = entity.state;
    const prevFacing = entity.facing;

    updateEntityMovement(entity, dt, {
      moveX: (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0),
      moveY: (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0),
      isRunModifier: this.shiftKey.isDown,
    });

    entity.position.x += entity.velocity.x * dt;
    entity.position.y += entity.velocity.y * dt;
    entity.sprite.setPosition(entity.position.x, entity.position.y);

    const stateChanged = entity.state !== prevState;
    const dirChanged = entity.state !== "idle" && entity.facing !== prevFacing;
    if (stateChanged || dirChanged) {
      playEntityAnimation(entity, this.catalog);
      if (stateChanged && entity.definition.kind === "player") {
        const payload: PlayerStateChangedPayload = { state: entity.state };
        this.game.events.emit(PLAYER_STATE_CHANGED_EVENT, payload);
      }
    }
  }

  private selectEntity(entity: WorldEntity | null): void {
    if (this.selectedEntity === entity) return;
    if (this.selectedEntity) {
      this.selectedEntity.sprite.clearTint();
    }
    this.selectedEntity = entity;
    if (entity) {
      entity.sprite.setTint(SELECTED_TINT);
    }
  }

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (!this.catalog || !this.entityRegistry) return;

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = this.entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (!runtime || !runtime.definition.placeable) return;
    const { definition } = runtime;

    const worldPoint = this.cameras.main.getWorldPoint(spawnRequest.screenX, spawnRequest.screenY);
    const entity = createWorldEntity({
      scene: this,
      catalog: this.catalog,
      runtime,
      nextId: this.nextId,
      worldX: worldPoint.x,
      worldY: worldPoint.y,
      spriteScale: SPRITE_SCALE,
    });
    if (!entity) return;

    this.nextId += 1;
    this.entities.push(entity);
    this.selectEntity(entity);

    if (definition.kind === "player") {
      const placedPayload: PlayerPlacedPayload = { worldX: worldPoint.x, worldY: worldPoint.y };
      this.game.events.emit(PLAYER_PLACED_EVENT, placedPayload);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    } else if (pointer.button === 0) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      let hit: WorldEntity | null = null;
      for (const entity of this.entities) {
        const bounds = entity.sprite.getBounds();
        if (bounds.contains(worldPoint.x, worldPoint.y)) {
          hit = entity;
          break;
        }
      }
      this.selectEntity(hit);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isPanning) return;
    const zoom = this.cameras.main.zoom;
    const dx = (pointer.x - this.panStartX) / zoom;
    const dy = (pointer.y - this.panStartY) / zoom;
    this.cameras.main.setScroll(this.camStartX - dx, this.camStartY - dy);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = false;
    }
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    const cam = this.cameras.main;
    const factor = dy > 0 ? 0.9 : 1.1;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
  }
}
