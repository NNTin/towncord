import type { EntityAction, SpawnSpec } from "./model";

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

export interface CanBePlaced {
  createSpawnSpec(): SpawnSpec;
}
