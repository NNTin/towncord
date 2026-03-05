import { deriveCapabilitiesFromBehavior, type ActionContext, type EntityBehavior } from "./capabilities";
import type { CatalogPathRef, EntityAction, EntityDefinition } from "./model";

export type PlayerArchetypeSeed = {
  model: string;
  catalogPath: CatalogPathRef;
};

export type NpcArchetypeSeed = {
  family: string;
  mobId: string;
  catalogPath: CatalogPathRef;
};

export type BuildArchetypeRuntimesInput = {
  players: readonly PlayerArchetypeSeed[];
  npcs: readonly NpcArchetypeSeed[];
};

export type ArchetypeRuntime = {
  definition: EntityDefinition;
  behavior: EntityBehavior;
};

type BuildRuntimeInput = {
  id: string;
  label: string;
  kind: "player" | "npc";
  catalogPath: CatalogPathRef;
  behavior: EntityBehavior;
};

function buildRuntime(input: BuildRuntimeInput): ArchetypeRuntime {
  const { id, label, kind, catalogPath, behavior } = input;
  return {
    definition: {
      id,
      label,
      kind,
      catalogPath,
      capabilities: deriveCapabilitiesFromBehavior(behavior),
      placeable: true,
    },
    behavior,
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
    label: seed.model,
    kind: "player",
    catalogPath: seed.catalogPath,
    behavior: createPlayerBehavior(),
  });
}

function buildNpcRuntime(seed: NpcArchetypeSeed): ArchetypeRuntime {
  return buildRuntime({
    id: `npc.${seed.family}.${seed.mobId}`,
    label: seed.mobId,
    kind: "npc",
    catalogPath: seed.catalogPath,
    behavior: createNpcBehavior(),
  });
}

export function buildArchetypeRuntimes(input: BuildArchetypeRuntimesInput): ArchetypeRuntime[] {
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
