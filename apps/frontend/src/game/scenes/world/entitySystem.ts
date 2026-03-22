import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { RegisteredEntity } from "../../domain/entityRegistry";
import {
  type PlayerStateChangedPayload,
} from "../../protocol";
import { playEntityAnimation } from "./animationSystem";
import {
  AUTONOMY_IDLE_DELAY_MS,
  resetEntityAutonomy,
  updateEntityAutonomy,
} from "./autonomySystem";
import { createWorldEntity, WORLD_ENTITY_SPRITE_ORIGIN_Y } from "./entityFactory";
import type { MovementInput } from "./movementSystem";
import { updateEntityMovement } from "./movementSystem";
import type { WorldNavigationService } from "./navigation";
import type { WorldEntity, WorldPoint, WorldSelectableActor } from "./types";
import type Phaser from "phaser";

const SPRITE_SCALE = 1;

type EntitySystemContext = {
  scene: Phaser.Scene;
  catalog: AnimationCatalog;
  navigation: WorldNavigationService;
  /** Called to project selected player movement state back to the app layer. */
  emitPlayerStateChanged: (payload: PlayerStateChangedPayload) => void;
  /** Called after each entity update if the entity is the currently selected one, to sync the selection badge. */
  onSelectedEntityUpdated: (entity: WorldSelectableActor) => void;
};

/**
 * Owns the entity array, next-ID counter, selection state, and the per-entity
 * update pipeline (autonomy → movement → velocity resolution → position sync →
 * y-sort depth → animation state transitions).
 *
 * WorldScene.update() delegates the entire per-entity loop to
 * EntitySystem.update() and becomes a thin coordinator.
 */
export class EntitySystem {
  private entities: WorldEntity[] = [];
  private selectedEntity: WorldEntity | null = null;
  private nextId = 0;
  private directInputIdleMs = 0;

  private readonly context: EntitySystemContext;

  constructor(context: EntitySystemContext) {
    this.context = context;
  }

  // -------------------------------------------------------------------------
  // Entity lifecycle
  // -------------------------------------------------------------------------

  /**
   * Creates and registers a new entity from the given runtime definition,
   * advancing the internal ID counter.  Returns null if the entity cannot be
   * created (e.g. missing animation data).
   */
  addEntity(
    runtime: RegisteredEntity,
    worldX: number,
    worldY: number,
  ): WorldEntity | null {
    const { scene, catalog } = this.context;
    const entity = createWorldEntity({
      scene,
      catalog,
      runtime,
      nextId: this.nextId,
      worldX,
      worldY,
      spriteScale: SPRITE_SCALE,
    });
    if (!entity) return null;

    this.nextId += 1;
    this.entities.push(entity);
    return entity;
  }

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  select(entity: WorldEntity | null): void {
    this.selectedEntity = entity;
  }

  getSelected(): WorldEntity | null {
    return this.selectedEntity;
  }

  findBySpriteTarget(sprite: unknown): WorldEntity | null {
    return this.entities.find((e) => e.sprite === sprite) ?? null;
  }

  getAll(): readonly WorldEntity[] {
    return this.entities;
  }

  // -------------------------------------------------------------------------
  // Per-frame update
  // -------------------------------------------------------------------------

  /**
   * Runs the full per-entity pipeline for one frame:
   *   1. Autonomy tick (wander / ambient actions)
   *   2. Movement integration (velocity → state → facing)
   *   3. Velocity resolution against the navigation/collision map
   *   4. Sprite position + y-sort depth sync
   *   5. Animation state transitions
   *
   * @param delta  Frame delta in milliseconds (as Phaser passes it).
   * @param directInput  Movement input from the player keyboard for the selected entity.
   */
  update(delta: number, directInput: MovementInput): void {
    const { catalog, navigation, emitPlayerStateChanged, onSelectedEntityUpdated } = this.context;
    const dt = delta / 1000;

    const hasDirectMovement = directInput.moveX !== 0 || directInput.moveY !== 0;
    this.directInputIdleMs = hasDirectMovement ? 0 : this.directInputIdleMs + delta;
    const autoplayEnabled = this.directInputIdleMs >= AUTONOMY_IDLE_DELAY_MS;

    const selectedEntity = this.selectedEntity;

    for (const entity of this.entities) {
      const prevState = entity.state;
      const prevFacing = entity.facing;
      const prevAnimationAction = entity.animationAction;
      const isSelected = entity === selectedEntity;

      // --- 1. Autonomy / input resolution ---
      const movementInput: MovementInput =
        isSelected && hasDirectMovement
          ? directInput
          : updateEntityAutonomy(entity, delta, {
              autoplayEnabled,
              navigation,
            });

      if (isSelected && hasDirectMovement) {
        resetEntityAutonomy(entity);
      }

      // --- 2. Movement integration ---
      updateEntityMovement(entity, dt, movementInput);
      if (!entity.autonomy.currentAmbientAction) {
        entity.animationAction = entity.state;
      }

      // --- 3. Velocity resolution against collision map ---
      const nextPosition: WorldPoint = {
        x: entity.position.x + entity.velocity.x * dt,
        y: entity.position.y + entity.velocity.y * dt,
      };
      const resolvedPosition = this.resolveEntityPosition(entity.position, nextPosition, navigation);
      entity.position.x = resolvedPosition.x;
      entity.position.y = resolvedPosition.y;
      if (resolvedPosition.x !== nextPosition.x) {
        entity.velocity.x = 0;
      }
      if (resolvedPosition.y !== nextPosition.y) {
        entity.velocity.y = 0;
      }

      // --- 4. Sprite sync + y-sort depth ---
      entity.sprite.setPosition(entity.position.x, entity.position.y);
      entity.sprite.setDepth(entity.position.y);

      if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.state !== "idle") {
        entity.state = "idle";
        if (!entity.autonomy.currentAmbientAction) {
          entity.animationAction = entity.state;
        }
      }

      // --- 5. Animation state transitions ---
      const stateChanged = entity.state !== prevState;
      const dirChanged = entity.state !== "idle" && entity.facing !== prevFacing;
      const animationChanged = entity.animationAction !== prevAnimationAction;
      if (stateChanged || dirChanged || animationChanged) {
        playEntityAnimation(entity, catalog);
        if (isSelected && stateChanged && entity.definition.kind === "player") {
          const payload: PlayerStateChangedPayload = { state: entity.state };
          emitPlayerStateChanged(payload);
        }
      }

      if (isSelected) {
        onSelectedEntityUpdated(entity);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Position resolution (collision)
  // -------------------------------------------------------------------------

  private resolveEntityPosition(
    current: WorldPoint,
    next: WorldPoint,
    navigation: WorldNavigationService,
  ): WorldPoint {
    const clampedNext = navigation.clampToBounds(next);
    if (navigation.isWalkable(clampedNext)) {
      return clampedNext;
    }

    const xOnly = navigation.clampToBounds({ x: clampedNext.x, y: current.y });
    if (navigation.isWalkable(xOnly)) {
      return xOnly;
    }

    const yOnly = navigation.clampToBounds({ x: current.x, y: clampedNext.y });
    if (navigation.isWalkable(yOnly)) {
      return yOnly;
    }

    return current;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  dispose(): void {
    for (const entity of this.entities) {
      entity.sprite.destroy();
    }
    this.entities = [];
    this.selectedEntity = null;
    this.nextId = 0;
    this.directInputIdleMs = 0;
  }

  /**
   * Returns the badge vertical offset helper so callers can position UI badges
   * above entities without importing the constant directly.
   */
  static get spriteOriginY(): number {
    return WORLD_ENTITY_SPRITE_ORIGIN_Y;
  }
}
