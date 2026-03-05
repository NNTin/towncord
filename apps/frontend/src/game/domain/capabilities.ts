import type { EntityAction, EntityCapability } from "./model";

export type ActionContext = {
  deltaSeconds: number;
};

export interface CanIdle {
  idle(ctx: ActionContext): EntityAction;
}

export interface CanWalk {
  walk(ctx: ActionContext): EntityAction;
}

export interface CanRun {
  run(ctx: ActionContext): EntityAction;
}

export type EntityBehavior = CanIdle & Partial<CanWalk & CanRun>;

export function supportsWalk(behavior: EntityBehavior): behavior is EntityBehavior & CanWalk {
  return typeof (behavior as { walk?: unknown }).walk === "function";
}

export function supportsRun(behavior: EntityBehavior): behavior is EntityBehavior & CanRun {
  return typeof (behavior as { run?: unknown }).run === "function";
}

export function deriveCapabilitiesFromBehavior(behavior: EntityBehavior): EntityCapability[] {
  const capabilities: EntityCapability[] = ["idle"];
  if (supportsWalk(behavior)) capabilities.push("walk");
  if (supportsRun(behavior)) capabilities.push("run");
  return capabilities;
}
