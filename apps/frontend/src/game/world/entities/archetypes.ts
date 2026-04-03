import {
  deriveCapabilitiesFromBehavior,
  type ActionContext,
  type EntityBehavior,
} from "./capabilities";
import type { EntityAction, EntityDefinition, EntityVisualRef } from "./model";

export type PlayerArchetypeSeed = {
  model: string;
  label?: string;
  visualRef: EntityVisualRef;
};

export type NpcArchetypeSeed = {
  family: string;
  mobId: string;
  visualRef: EntityVisualRef;
};

type BuildArchetypeRuntimesInput = {
  players: readonly PlayerArchetypeSeed[];
  npcs: readonly NpcArchetypeSeed[];
};

type ArchetypeRuntime = {
  definition: EntityDefinition;
  createBehavior: () => EntityBehavior;
};

type BuildRuntimeInput = {
  id: string;
  label: string;
  kind: "player" | "npc";
  visualRef: EntityVisualRef;
  createBehavior: () => EntityBehavior;
};

function buildRuntime(input: BuildRuntimeInput): ArchetypeRuntime {
  const { id, label, kind, visualRef, createBehavior } = input;
  const behavior = createBehavior();
  return {
    definition: {
      id,
      label,
      kind,
      visualRef,
      capabilities: deriveCapabilitiesFromBehavior(behavior),
      placeable: true,
    },
    createBehavior,
  };
}

function createPlayerBehavior(): EntityBehavior {
  return {
    idle(_ctx: ActionContext): EntityAction {
      return "idle";
    },
    walk(_ctx: ActionContext): EntityAction {
      return "walk";
    },
    run(_ctx: ActionContext): EntityAction {
      return "run";
    },
  };
}

function createNpcBehavior(): EntityBehavior {
  return {
    idle(_ctx: ActionContext): EntityAction {
      return "idle";
    },
    walk(_ctx: ActionContext): EntityAction {
      return "walk";
    },
  };
}

function buildPlayerRuntime(seed: PlayerArchetypeSeed): ArchetypeRuntime {
  return buildRuntime({
    id: `player.${seed.model}`,
    label: seed.label ?? seed.model,
    kind: "player",
    visualRef: seed.visualRef,
    createBehavior: createPlayerBehavior,
  });
}

function buildNpcRuntime(seed: NpcArchetypeSeed): ArchetypeRuntime {
  return buildRuntime({
    id: `npc.${seed.family}.${seed.mobId}`,
    label: seed.mobId,
    kind: "npc",
    visualRef: seed.visualRef,
    createBehavior: createNpcBehavior,
  });
}

export function buildArchetypeRuntimes(
  input: BuildArchetypeRuntimesInput,
): ArchetypeRuntime[] {
  const runtimes: ArchetypeRuntime[] = [];
  const seenNpcEntityIds = new Set<string>();

  for (const player of input.players) {
    runtimes.push(buildPlayerRuntime(player));
  }

  for (const npc of input.npcs) {
    const runtime = buildNpcRuntime(npc);
    if (seenNpcEntityIds.has(runtime.definition.id)) continue;
    seenNpcEntityIds.add(runtime.definition.id);
    runtimes.push(runtime);
  }

  return runtimes;
}
