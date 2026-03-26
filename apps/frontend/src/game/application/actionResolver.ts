import {
  supportsRun,
  supportsWalk,
  type ActionContext,
  type EntityBehavior,
} from "../world/entities/capabilities";
import type { EntityAction } from "../world/entities/model";

type ActionResolverInput = {
  isMoving: boolean;
  isRunModifier: boolean;
  deltaSeconds: number;
};

export function resolveNextAction(
  behavior: EntityBehavior,
  input: ActionResolverInput,
): EntityAction {
  const context: ActionContext = { deltaSeconds: input.deltaSeconds };

  if (input.isMoving && input.isRunModifier && supportsRun(behavior)) {
    return behavior.run(context);
  }

  if (input.isMoving && supportsWalk(behavior)) {
    return behavior.walk(context);
  }

  return behavior.idle(context);
}
