import { supportsWalk } from "../../domain/capabilities";
import type { WorldEntity } from "./types";
import type { WorldNavigationService } from "./navigation";
import type { MovementInput } from "./movementSystem";

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
const AUTONOMY_DECISION_DELAY_MS = 350;

export type AutonomyUpdateContext = {
  autoplayEnabled: boolean;
  navigation: WorldNavigationService;
  rng?: () => number;
};

export function createAutonomyState(ambientActionIds: readonly string[]) {
  return {
    ambientActionIds,
    ambientCooldownMs: 0,
    currentAmbientAction: null,
    currentAmbientMs: 0,
    nextDecisionMs: AUTONOMY_DECISION_DELAY_MS,
    wanderTarget: null,
  };
}

export function resetEntityAutonomy(entity: WorldEntity): void {
  entity.autonomy.currentAmbientAction = null;
  entity.autonomy.currentAmbientMs = 0;
  entity.autonomy.nextDecisionMs = AUTONOMY_DECISION_DELAY_MS;
  entity.autonomy.wanderTarget = null;
  entity.animationAction = entity.state;
}

export function updateEntityAutonomy(
  entity: WorldEntity,
  deltaMs: number,
  context: AutonomyUpdateContext,
): MovementInput {
  const rng = context.rng ?? Math.random;
  entity.autonomy.ambientCooldownMs = Math.max(0, entity.autonomy.ambientCooldownMs - deltaMs);

  if (!context.autoplayEnabled || !supportsWalk(entity.behavior)) {
    resetEntityAutonomy(entity);
    return ZERO_INPUT;
  }

  if (entity.autonomy.currentAmbientAction) {
    entity.autonomy.currentAmbientMs = Math.max(0, entity.autonomy.currentAmbientMs - deltaMs);
    entity.animationAction = entity.autonomy.currentAmbientAction;

    if (entity.autonomy.currentAmbientMs === 0) {
      entity.autonomy.currentAmbientAction = null;
      entity.animationAction = entity.state;
      entity.autonomy.ambientCooldownMs = AMBIENT_ACTION_COOLDOWN_MS;
      entity.autonomy.nextDecisionMs = AUTONOMY_DECISION_DELAY_MS;
    }

    return ZERO_INPUT;
  }

  if (entity.autonomy.wanderTarget) {
    const step = context.navigation.getStepToward(entity, entity.autonomy.wanderTarget);
    entity.animationAction = entity.state;

    if (step.reached) {
      entity.autonomy.wanderTarget = null;
      entity.autonomy.nextDecisionMs = AUTONOMY_DECISION_DELAY_MS;
      return ZERO_INPUT;
    }

    return {
      moveX: step.moveX,
      moveY: step.moveY,
      isRunModifier: false,
    };
  }

  entity.autonomy.nextDecisionMs = Math.max(0, entity.autonomy.nextDecisionMs - deltaMs);
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

  entity.autonomy.wanderTarget = context.navigation.pickWanderTarget(entity, rng);
  entity.animationAction = entity.state;

  if (!entity.autonomy.wanderTarget) {
    entity.autonomy.nextDecisionMs = AUTONOMY_DECISION_DELAY_MS;
    return ZERO_INPUT;
  }

  const step = context.navigation.getStepToward(entity, entity.autonomy.wanderTarget);
  if (step.reached) {
    entity.autonomy.wanderTarget = null;
    entity.autonomy.nextDecisionMs = AUTONOMY_DECISION_DELAY_MS;
    return ZERO_INPUT;
  }

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
