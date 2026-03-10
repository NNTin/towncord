import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
  type BloomseedWorldBootstrap,
} from "../application/gameComposition";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  PLAYER_STATE_CHANGED_EVENT,
  RUNTIME_PERF_EVENT,
  SELECT_TERRAIN_TOOL_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type PlayerPlacedPayload,
  type PlayerStateChangedPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
} from "../events";
import { TerrainSystem } from "../terrain";
import { playEntityAnimation } from "./world/animationSystem";
import { createWorldEntity } from "./world/entityFactory";
import { updateEntityMovement } from "./world/movementSystem";
import { TerrainPaintSession } from "./world/terrainPaintSession";
import type { WorldEntity } from "./world/types";

export const WORLD_SCENE_KEY = "world";

const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const SELECTED_BADGE_ANIMATION_KEY = "props.bloomseed.static.rocks.variant-03";
const SELECTED_BADGE_SCALE = 2;
const SELECTED_BADGE_VERTICAL_OFFSET = 12;

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;
  private entityRegistry: BloomseedWorldBootstrap["entityRegistry"] | null = null;

  private entities: WorldEntity[] = [];
  private selectedEntity: WorldEntity | null = null;
  private selectionBadge: Phaser.GameObjects.Sprite | null = null;
  private terrainSystem: TerrainSystem | null = null;
  private nextId = 0;

  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private activeTerrainTool: SelectedTerrainToolPayload = null;
  private readonly terrainPaintSession = new TerrainPaintSession();

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private lastPerfEmitAtMs = 0;

  constructor() {
    super(WORLD_SCENE_KEY);
  }

  public create(): void {
    const bootstrap = getBloomseedWorldBootstrap(
      this.registry.get(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY),
    );
    if (bootstrap) {
      this.catalog = bootstrap.catalog;
      this.entityRegistry = bootstrap.entityRegistry;
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

    this.terrainSystem = new TerrainSystem(this);
    this.game.events.on(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.on(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.on(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.events.once(
      "shutdown",
      () => {
        this.terrainSystem?.destroy();
        this.terrainSystem = null;
        this.selectionBadge?.destroy();
        this.selectionBadge = null;
        this.game.events.off(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
        this.game.events.off(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
        this.game.events.off(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
        this.input.off("pointerdown", this.onPointerDown, this);
        this.input.off("pointermove", this.onPointerMove, this);
        this.input.off("pointerup", this.onPointerUp, this);
        this.input.off("wheel", this.onWheel, this);
      },
      this,
    );

    this.createSelectionBadge();
  }

  public override update(_time: number, delta: number): void {
    const updateStart = performance.now();

    const terrainStart = performance.now();
    this.terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    if (this.selectedEntity && this.wasd && this.shiftKey && this.catalog) {
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

      this.syncSelectionBadgePosition(entity);
    }

    const now = performance.now();
    if (now - this.lastPerfEmitAtMs >= 100) {
      const updateMs = now - updateStart;
      const fps = delta > 0 ? 1000 / delta : 0;
      const payload: RuntimePerfPayload = {
        timestampMs: now,
        fps,
        frameMs: delta,
        updateMs,
        terrainMs,
      };
      this.game.events.emit(RUNTIME_PERF_EVENT, payload);
      this.lastPerfEmitAtMs = now;
    }
  }

  private selectEntity(entity: WorldEntity | null): void {
    if (this.selectedEntity === entity) return;
    this.selectedEntity = entity;
    this.setSelectionBadgeVisible(Boolean(entity));
    if (entity) this.syncSelectionBadgePosition(entity);
  }

  private createSelectionBadge(): void {
    const firstFrame = this.anims.get(SELECTED_BADGE_ANIMATION_KEY)?.frames[0];
    if (!firstFrame) return;

    const badge = this.add.sprite(0, 0, firstFrame.textureKey, firstFrame.textureFrame);
    badge.setScale(SELECTED_BADGE_SCALE);
    badge.setDepth(10_000);
    badge.setVisible(false);
    this.selectionBadge = badge;
  }

  private setSelectionBadgeVisible(visible: boolean): void {
    if (!this.selectionBadge) return;
    this.selectionBadge.setVisible(visible);
  }

  private syncSelectionBadgePosition(entity: WorldEntity): void {
    if (!this.selectionBadge) return;
    this.selectionBadge.setPosition(
      entity.position.x,
      entity.position.y - entity.sprite.displayHeight * 0.5 - SELECTED_BADGE_VERTICAL_OFFSET,
    );
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

  private onPlaceTerrainDrop(payload: PlaceTerrainDropPayload): void {
    if (!this.terrainSystem) return;
    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
    this.terrainSystem.queueDrop(payload, worldPoint.x, worldPoint.y);
  }

  private onSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    this.activeTerrainTool = payload;
    this.terrainPaintSession.end();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    } else if (pointer.button === 0) {
      if (this.activeTerrainTool) {
        this.terrainPaintSession.begin();
        this.paintTerrainAtScreen(pointer.x, pointer.y);
        return;
      }

      let hit: WorldEntity | null = null;
      const hits = this.input.sortGameObjects(this.input.hitTestPointer(pointer), pointer);

      for (const target of hits) {
        const entity = this.entities.find((candidate) => candidate.sprite === target);
        if (entity) {
          hit = entity;
          break;
        }
      }

      this.selectEntity(hit);

      if (this.terrainSystem) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const inspected = this.terrainSystem.inspectAtWorld(worldPoint.x, worldPoint.y);
        if (inspected) {
          const payload: TerrainTileInspectedPayload = inspected;
          this.game.events.emit(TERRAIN_TILE_INSPECTED_EVENT, payload);
        }
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPanning) {
      const zoom = this.cameras.main.zoom;
      const dx = (pointer.x - this.panStartX) / zoom;
      const dy = (pointer.y - this.panStartY) / zoom;
      this.cameras.main.setScroll(this.camStartX - dx, this.camStartY - dy);
      return;
    }

    if (!this.activeTerrainTool || !this.terrainPaintSession.isActive()) return;
    this.paintTerrainAtScreen(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = false;
    } else if (pointer.button === 0) {
      this.terrainPaintSession.end();
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

  private paintTerrainAtScreen(screenX: number, screenY: number): void {
    if (!this.activeTerrainTool || !this.terrainSystem) return;

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const cell = this.terrainSystem.getGameplayGrid().worldToCell(worldPoint.x, worldPoint.y);
    if (!cell || !this.terrainPaintSession.shouldPaintCell(cell)) return;

    this.terrainSystem.queueDrop(
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
}
