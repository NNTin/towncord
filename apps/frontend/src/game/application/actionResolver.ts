import { supportsRun, supportsWalk, type ActionContext, type EntityBehavior } from "../domain/capabilities";
import type { EntityAction } from "../domain/model";

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
