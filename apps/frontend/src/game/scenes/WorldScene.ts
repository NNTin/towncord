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

type PlayerState = "idle" | "move" | "run";

type PlayerRuntime = {
  placed: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  facing: InputDirection;
  state: PlayerState;
  model: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_TO_TRACK_IDS: Record<PlayerState, string[]> = {
  idle: ["idle"],
  move: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
};

const WALK_SPEED = 100;
const RUN_SPEED = 220;
/** Per-frame velocity retention at 60 fps when keys released (fast ease-out). */
const STOP_DAMPING_60FPS = 0.75;
const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;

  // Placed player — drag-drop + WASD
  private player: PlayerRuntime | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;

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
    if (this.player?.placed) {
      this.updatePlayer(delta / 1000);
    }
  }

  // ---------------------------------------------------------------------------
  // Player update
  // ---------------------------------------------------------------------------

  private updatePlayer(dt: number): void {
    const p = this.player!;
    const wasd = this.wasd!;
    const shift = this.shiftKey!;

    const moveX = (wasd.D.isDown ? 1 : 0) - (wasd.A.isDown ? 1 : 0);
    const moveY = (wasd.S.isDown ? 1 : 0) - (wasd.W.isDown ? 1 : 0);
    const isMoving = moveX !== 0 || moveY !== 0;
    const isRunModifier = shift.isDown;

    const prevState = p.state;
    const prevFacing = p.facing;

    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      const speed = isRunModifier ? RUN_SPEED : WALK_SPEED;
      p.velocity.x = (moveX / len) * speed;
      p.velocity.y = (moveY / len) * speed;

      if (Math.abs(moveX) >= Math.abs(moveY)) {
        p.facing = moveX > 0 ? "right" : "left";
      } else {
        p.facing = moveY > 0 ? "down" : "up";
      }

      p.state = isRunModifier ? "run" : "move";
    } else {
      const dampFactor = Math.pow(STOP_DAMPING_60FPS, dt * 60);
      p.velocity.x *= dampFactor;
      p.velocity.y *= dampFactor;

      const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2);
      if (speed < 1) {
        p.velocity.x = 0;
        p.velocity.y = 0;
        p.state = "idle";
      } else {
        p.state = "move";
      }
    }

    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    this.playerSprite?.setPosition(p.position.x, p.position.y);

    const stateChanged = p.state !== prevState;
    const dirChanged = p.state !== "idle" && p.facing !== prevFacing;
    if (stateChanged || dirChanged) {
      this.playPlayerAnimation();
      if (stateChanged) {
        const payload: PlayerStateChangedPayload = { state: p.state };
        this.game.events.emit(PLAYER_STATE_CHANGED_EVENT, payload);
      }
    }
  }

  private resolvePlayerTrack(): AnimationTrack | null {
    if (!this.player || !this.catalog) return null;
    const tracks = getTracksForPath(this.catalog, `player/${this.player.model}`);
    const candidates = STATE_TO_TRACK_IDS[this.player.state] ?? ["idle"];
    for (const id of candidates) {
      const track = tracks.find((t) => t.id === id);
      if (track) return track;
    }
    return tracks[0] ?? null;
  }

  private playPlayerAnimation(): void {
    if (!this.playerSprite || !this.player) return;
    const track = this.resolvePlayerTrack();
    if (!track) return;

    const result = resolveTrackForDirection(track, this.player.facing);
    if (!result) return;

    this.playerSprite.setFlipX(result.flipX);
    this.playerSprite.play(result.key, true);
  }

  // ---------------------------------------------------------------------------
  // Drop handler
  // ---------------------------------------------------------------------------

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (payload.type !== "player" || !this.catalog) return;

    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);

    if (this.player && this.playerSprite) {
      this.player.model = payload.model;
      this.player.position.x = worldPoint.x;
      this.player.position.y = worldPoint.y;
      this.player.velocity.x = 0;
      this.player.velocity.y = 0;
      this.player.state = "idle";
      this.playerSprite.setPosition(worldPoint.x, worldPoint.y);
      this.playPlayerAnimation();
    } else {
      const tracks = getTracksForPath(this.catalog, `player/${payload.model}`);
      const idleTrack = tracks.find((t) => t.id === "idle") ?? tracks[0];
      if (!idleTrack) return;

      const resolved = resolveTrackForDirection(idleTrack, "down");
      if (!resolved) return;

      const firstFrame = this.anims.get(resolved.key)?.frames[0];
      if (!firstFrame) return;

      this.player = {
        placed: true,
        position: { x: worldPoint.x, y: worldPoint.y },
        velocity: { x: 0, y: 0 },
        facing: "down",
        state: "idle",
        model: payload.model,
      };

      this.playerSprite = this.add.sprite(
        worldPoint.x,
        worldPoint.y,
        firstFrame.textureKey,
        firstFrame.textureFrame,
      );
      this.playerSprite.setScale(SPRITE_SCALE);
      this.playPlayerAnimation();
    }

    const placedPayload: PlayerPlacedPayload = { worldX: worldPoint.x, worldY: worldPoint.y };
    this.game.events.emit(PLAYER_PLACED_EVENT, placedPayload);
  }

  // ---------------------------------------------------------------------------
  // Camera controls
  // ---------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
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
