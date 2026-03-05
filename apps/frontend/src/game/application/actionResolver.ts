import { hasCapability, type EntityAction, type EntityDefinition } from "../domain/model";

export type ActionResolverInput = {
  isMoving: boolean;
  isRunModifier: boolean;
};

const TRACK_CANDIDATES: Record<EntityAction, string[]> = {
  idle: ["idle"],
  walk: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
};

export function resolveNextAction(
  definition: EntityDefinition,
  input: ActionResolverInput,
): EntityAction {
  if (input.isMoving && input.isRunModifier && hasCapability(definition, "run")) {
    return "run";
  }

  if (input.isMoving && hasCapability(definition, "walk")) {
    return "walk";
  }

  return "idle";
}

export function getTrackCandidatesForAction(action: EntityAction): string[] {
  return TRACK_CANDIDATES[action];
}
