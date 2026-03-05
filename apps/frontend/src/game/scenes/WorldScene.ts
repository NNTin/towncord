import Phaser from "phaser";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type InputDirection,
  buildAnimationCatalog,
  getTracksForPath,
  resolveTrackForDirection,
} from "../assets/animationCatalog";
import {
  PLACE_OBJECT_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  PLAYER_STATE_CHANGED_EVENT,
  type PlaceObjectDropPayload,
  type PlayerPlacedPayload,
  type PlayerStateChangedPayload,
} from "../events";

export const WORLD_SCENE_KEY = "world";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityState = "idle" | "move" | "run";

type Entity = {
  id: number;
  catalogPath: string;
  supportsRun: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  facing: InputDirection;
  state: EntityState;
  sprite: Phaser.GameObjects.Sprite;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_STATE_TO_TRACKS: Record<EntityState, string[]> = {
  idle: ["idle"],
  move: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
};

const MOB_STATE_TO_TRACKS: Record<EntityState, string[]> = {
  idle: ["idle", "walk"],
  move: ["walk", "idle"],
  run: ["walk", "idle"],
};

const WALK_SPEED = 100;
const RUN_SPEED = 220;
/** Per-frame velocity retention at 60 fps when keys released (fast ease-out). */
const STOP_DAMPING_60FPS = 0.75;
const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const SELECTED_TINT = 0x88bbff;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;

  private entities: Entity[] = [];
  private selectedEntity: Entity | null = null;
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
      ? rawKeys.filter((v): v is string => typeof v === "string")
      : [];
    if (animationKeys.length > 0) {
      this.catalog = buildAnimationCatalog(animationKeys);
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
    if (this.selectedEntity) {
      this.updateEntity(this.selectedEntity, delta / 1000);
    }
  }

  // ---------------------------------------------------------------------------
  // Entity update
  // ---------------------------------------------------------------------------

  private updateEntity(entity: Entity, dt: number): void {
    const wasd = this.wasd!;
    const shift = this.shiftKey!;

    const moveX = (wasd.D.isDown ? 1 : 0) - (wasd.A.isDown ? 1 : 0);
    const moveY = (wasd.S.isDown ? 1 : 0) - (wasd.W.isDown ? 1 : 0);
    const isMoving = moveX !== 0 || moveY !== 0;
    const isRunModifier = shift.isDown && entity.supportsRun;

    const prevState = entity.state;
    const prevFacing = entity.facing;

    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      const speed = isRunModifier ? RUN_SPEED : WALK_SPEED;
      entity.velocity.x = (moveX / len) * speed;
      entity.velocity.y = (moveY / len) * speed;

      if (Math.abs(moveX) >= Math.abs(moveY)) {
        entity.facing = moveX > 0 ? "right" : "left";
      } else {
        entity.facing = moveY > 0 ? "down" : "up";
      }

      entity.state = isRunModifier ? "run" : "move";
    } else {
      const dampFactor = Math.pow(STOP_DAMPING_60FPS, dt * 60);
      entity.velocity.x *= dampFactor;
      entity.velocity.y *= dampFactor;

      const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
      if (speed < 1) {
        entity.velocity.x = 0;
        entity.velocity.y = 0;
        entity.state = "idle";
      } else {
        entity.state = "move";
      }
    }

    entity.position.x += entity.velocity.x * dt;
    entity.position.y += entity.velocity.y * dt;
    entity.sprite.setPosition(entity.position.x, entity.position.y);

    const stateChanged = entity.state !== prevState;
    const dirChanged = entity.state !== "idle" && entity.facing !== prevFacing;
    if (stateChanged || dirChanged) {
      this.playEntityAnimation(entity);
      if (stateChanged && entity.catalogPath.startsWith("player/")) {
        const payload: PlayerStateChangedPayload = { state: entity.state };
        this.game.events.emit(PLAYER_STATE_CHANGED_EVENT, payload);
      }
    }
  }

  private resolveEntityTrack(
    catalogPath: string,
    state: EntityState,
    supportsRun: boolean,
  ): AnimationTrack | null {
    if (!this.catalog) return null;
    const tracks = getTracksForPath(this.catalog, catalogPath);
    const map = supportsRun ? PLAYER_STATE_TO_TRACKS : MOB_STATE_TO_TRACKS;
    const candidates = map[state] ?? ["idle"];
    for (const id of candidates) {
      const track = tracks.find((t) => t.id === id);
      if (track) return track;
    }
    return tracks[0] ?? null;
  }

  private playEntityAnimation(entity: Entity): void {
    const track = this.resolveEntityTrack(entity.catalogPath, entity.state, entity.supportsRun);
    if (!track) return;
    const result = resolveTrackForDirection(track, entity.facing);
    if (!result) return;

    let flipX = result.flipX;
    // Undirected mob tracks (e.g. bat-walk) should keep last horizontal facing on up/down.
    if (!entity.supportsRun && !track.directional) {
      if (entity.facing === "left") {
        flipX = true;
      } else if (entity.facing === "right") {
        flipX = false;
      } else {
        flipX = entity.sprite.flipX;
      }
    }

    entity.sprite.setFlipX(flipX);
    entity.sprite.play(result.key, true);
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  private selectEntity(entity: Entity | null): void {
    if (this.selectedEntity === entity) return;
    if (this.selectedEntity) {
      this.selectedEntity.sprite.clearTint();
    }
    this.selectedEntity = entity;
    if (entity) {
      entity.sprite.setTint(SELECTED_TINT);
    }
  }

  // ---------------------------------------------------------------------------
  // Drop handler
  // ---------------------------------------------------------------------------

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (!this.catalog) return;

    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
    const supportsRun = payload.type === "player";
    const idleTrack = this.resolveEntityTrack(payload.catalogPath, "idle", supportsRun);
    if (!idleTrack) return;

    const resolved = resolveTrackForDirection(idleTrack, "down");
    if (!resolved) return;

    const firstFrame = this.anims.get(resolved.key)?.frames[0];
    if (!firstFrame) return;

    const sprite = this.add.sprite(
      worldPoint.x,
      worldPoint.y,
      firstFrame.textureKey,
      firstFrame.textureFrame,
    );
    sprite.setScale(SPRITE_SCALE);
    sprite.setFlipX(resolved.flipX);
    sprite.play(resolved.key, true);

    const entity: Entity = {
      id: this.nextId++,
      catalogPath: payload.catalogPath,
      supportsRun,
      position: { x: worldPoint.x, y: worldPoint.y },
      velocity: { x: 0, y: 0 },
      facing: "down",
      state: "idle",
      sprite,
    };

    this.entities.push(entity);
    this.selectEntity(entity);

    if (payload.type === "player") {
      const placedPayload: PlayerPlacedPayload = { worldX: worldPoint.x, worldY: worldPoint.y };
      this.game.events.emit(PLAYER_PLACED_EVENT, placedPayload);
    }
  }

  // ---------------------------------------------------------------------------
  // Camera controls + left-click selection
  // ---------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    } else if (pointer.button === 0) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      let hit: Entity | null = null;
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
