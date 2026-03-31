import { supportsWalk } from "../../world/entities/capabilities";
import type { AutonomyNavigationService } from "../../../engine/world-runtime/spatial";
import type { MovementInput } from "./movementSystem";
import type { WorldAutonomyActor } from "./types";

export const AUTONOMY_IDLE_DELAY_MS = 2_500;

const ZERO_INPUT: MovementInput = {
  moveX: 0,
  moveY: 0,
  isRunModifier: false,
};

const AMBIENT_ACTION_MIN_MS = 900;
const AMBIENT_ACTION_MAX_MS = 1_600;
const AMBIENT_ACTION_CHANCE = 0.35;
const AMBIENT_ACTION_COOLDOWN_MS = 2_400;
/** Minimum wait between autonomous decisions (wander / ambient). */
const AUTONOMY_DECISION_MIN_MS = 2_000;
/** Maximum wait between autonomous decisions. */
const AUTONOMY_DECISION_MAX_MS = 5_000;
/** Short retry delay used when no action could be found (prevents busy-spin). */
const AUTONOMY_RETRY_DELAY_MS = 500;

type AutonomyUpdateContext = {
  autoplayEnabled: boolean;
  navigation: AutonomyNavigationService;
  rng?: () => number;
};

/**
 * Creates initial autonomy state for an entity.
 *
 * Pass an `rng` function to stagger the first decision across multiple entities
 * so they do not all start wandering at the same moment. In tests you can omit
 * `rng` (or pass `() => 0`) to get a deterministic zero initial delay.
 */
export function createAutonomyState(
  ambientActionIds: readonly string[],
  rng?: () => number,
) {
  const initialDelay = rng ? Math.round(rng() * AUTONOMY_DECISION_MAX_MS) : 0;
  return {
    ambientActionIds,
    ambientCooldownMs: 0,
    currentAmbientAction: null,
    currentAmbientMs: 0,
    nextDecisionMs: initialDelay,
    path: [],
    pathIndex: 0,
    pathRevision: null,
    wanderTarget: null,
  };
}

export function resetEntityAutonomy(entity: WorldAutonomyActor): void {
  entity.autonomy.currentAmbientAction = null;
  entity.autonomy.currentAmbientMs = 0;
  entity.autonomy.nextDecisionMs = AUTONOMY_RETRY_DELAY_MS;
  entity.autonomy.path = [];
  entity.autonomy.pathIndex = 0;
  entity.autonomy.pathRevision = null;
  entity.autonomy.wanderTarget = null;
  entity.animationAction = entity.state;
}

export function updateEntityAutonomy(
  entity: WorldAutonomyActor,
  deltaMs: number,
  context: AutonomyUpdateContext,
): MovementInput {
  const rng = context.rng ?? Math.random;
  entity.autonomy.ambientCooldownMs = Math.max(
    0,
    entity.autonomy.ambientCooldownMs - deltaMs,
  );

  if (!context.autoplayEnabled || !supportsWalk(entity.behavior)) {
    resetEntityAutonomy(entity);
    return ZERO_INPUT;
  }

  if (entity.autonomy.currentAmbientAction) {
    entity.autonomy.currentAmbientMs = Math.max(
      0,
      entity.autonomy.currentAmbientMs - deltaMs,
    );
    entity.animationAction = entity.autonomy.currentAmbientAction;

    if (entity.autonomy.currentAmbientMs === 0) {
      entity.autonomy.currentAmbientAction = null;
      entity.animationAction = entity.state;
      entity.autonomy.ambientCooldownMs = AMBIENT_ACTION_COOLDOWN_MS;
      entity.autonomy.nextDecisionMs = lerp(
        AUTONOMY_DECISION_MIN_MS,
        AUTONOMY_DECISION_MAX_MS,
        rng(),
      );
    }

    return ZERO_INPUT;
  }

  if (
    entity.autonomy.path.length > 0 &&
    entity.autonomy.pathIndex < entity.autonomy.path.length &&
    context.navigation.isPathValid(entity.autonomy.pathRevision)
  ) {
    const waypoint = entity.autonomy.path[entity.autonomy.pathIndex]!;
    const step = context.navigation.getStepToward(entity, waypoint);
    entity.animationAction = entity.state;

    if (step.reached) {
      entity.autonomy.pathIndex += 1;
      if (entity.autonomy.pathIndex >= entity.autonomy.path.length) {
        entity.autonomy.path = [];
        entity.autonomy.pathIndex = 0;
        entity.autonomy.pathRevision = null;
        entity.autonomy.wanderTarget = null;
        entity.autonomy.nextDecisionMs = lerp(
          AUTONOMY_DECISION_MIN_MS,
          AUTONOMY_DECISION_MAX_MS,
          rng(),
        );
      }
      return ZERO_INPUT;
    }

    return {
      moveX: step.moveX,
      moveY: step.moveY,
      isRunModifier: false,
    };
  }

  entity.autonomy.path = [];
  entity.autonomy.pathIndex = 0;
  entity.autonomy.pathRevision = null;
  entity.autonomy.wanderTarget = null;

  entity.autonomy.nextDecisionMs = Math.max(
    0,
    entity.autonomy.nextDecisionMs - deltaMs,
  );
  if (entity.autonomy.nextDecisionMs > 0) {
    entity.animationAction = entity.state;
    return ZERO_INPUT;
  }

  if (
    entity.autonomy.ambientActionIds.length > 0 &&
    entity.autonomy.ambientCooldownMs === 0 &&
    rng() < AMBIENT_ACTION_CHANCE
  ) {
    const ambientAction = sample(entity.autonomy.ambientActionIds, rng);
    if (ambientAction) {
      entity.autonomy.currentAmbientAction = ambientAction;
      entity.autonomy.currentAmbientMs = lerp(
        AMBIENT_ACTION_MIN_MS,
        AMBIENT_ACTION_MAX_MS,
        rng(),
      );
      entity.animationAction = ambientAction;
      return ZERO_INPUT;
    }
  }

  entity.autonomy.wanderTarget = context.navigation.pickWanderTarget(
    entity,
    rng,
  );
  entity.animationAction = entity.state;

  if (!entity.autonomy.wanderTarget) {
    entity.autonomy.nextDecisionMs = AUTONOMY_RETRY_DELAY_MS;
    return ZERO_INPUT;
  }

  const path = context.navigation.planPath(
    entity,
    entity.autonomy.wanderTarget,
  );
  if (!path || path.waypoints.length === 0) {
    entity.autonomy.wanderTarget = null;
    entity.autonomy.nextDecisionMs = AUTONOMY_RETRY_DELAY_MS;
    return ZERO_INPUT;
  }

  entity.autonomy.path = path.waypoints;
  entity.autonomy.pathIndex = 0;
  entity.autonomy.pathRevision = path.revision;

  const step = context.navigation.getStepToward(entity, path.waypoints[0]!);
  return {
    moveX: step.moveX,
    moveY: step.moveY,
    isRunModifier: false,
  };
}

function sample(values: readonly string[], rng: () => number): string | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.floor(rng() * values.length));
  return values[index] ?? null;
}

function lerp(min: number, max: number, t: number): number {
  return Math.round(min + (max - min) * t);
}
