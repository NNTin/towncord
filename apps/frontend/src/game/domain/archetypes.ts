import {
  deriveCapabilitiesFromBehavior,
  type ActionContext,
  type CanBePlaced,
  type CanIdle,
  type CanRun,
  type CanWalk,
  type EntityBehavior,
} from "./capabilities";
import type { CatalogPathRef, EntityAction, EntityDefinition, SpawnSpec } from "./model";

export const NPC_PLACEABLE_IDS = ["chicken", "cow", "bat"] as const;
export type NpcPlaceableId = (typeof NPC_PLACEABLE_IDS)[number];

export function isNpcPlaceableId(value: string): value is NpcPlaceableId {
  return (NPC_PLACEABLE_IDS as readonly string[]).includes(value);
}

export type PlayerArchetypeSeed = {
  model: string;
  catalogPath: CatalogPathRef;
};

export type NpcArchetypeSeed = {
  family: string;
  mobId: NpcPlaceableId;
  catalogPath: CatalogPathRef;
};

export type BuildArchetypeRuntimesInput = {
  players: readonly PlayerArchetypeSeed[];
  npcs: readonly NpcArchetypeSeed[];
};

abstract class BaseArchetype implements CanBePlaced {
  protected abstract readonly id: string;
  protected abstract readonly label: string;
  protected abstract readonly kind: "player" | "npc";
  protected abstract readonly catalogPath: CatalogPathRef;

  public createSpawnSpec(): SpawnSpec {
    return { entityId: this.id, catalogPath: this.catalogPath };
  }

  public toRuntime(): ArchetypeRuntime {
    const behavior = this as unknown as EntityBehavior;
    return {
      definition: {
        id: this.id,
        label: this.label,
        kind: this.kind,
        catalogPath: this.catalogPath,
        capabilities: deriveCapabilitiesFromBehavior(behavior),
        placeable: true,
      },
      behavior,
    };
  }
}

export class PlayerArchetype extends BaseArchetype implements CanIdle, CanWalk, CanRun {
  protected readonly id: string;
  protected readonly label: string;
  protected readonly kind = "player" as const;
  protected readonly catalogPath: CatalogPathRef;

  public constructor(model: string, catalogPath: CatalogPathRef) {
    super();
    this.id = `player.${model}`;
    this.label = model;
    this.catalogPath = catalogPath;
  }

  public idle(_ctx: ActionContext): EntityAction {
    return "idle";
  }

  public walk(_ctx: ActionContext): EntityAction {
    return "walk";
  }

  public run(_ctx: ActionContext): EntityAction {
    return "run";
  }
}

abstract class BaseNpcArchetype extends BaseArchetype implements CanIdle, CanWalk {
  protected readonly kind = "npc" as const;

  public idle(_ctx: ActionContext): EntityAction {
    return "idle";
  }

  public walk(_ctx: ActionContext): EntityAction {
    return "walk";
  }
}

export type ArchetypeRuntime = {
  definition: EntityDefinition;
  behavior: EntityBehavior;
};

export class CowArchetype extends BaseNpcArchetype {
  protected readonly id: string;
  protected readonly label = "cow";
  protected readonly catalogPath: CatalogPathRef;

  public constructor(family: string, catalogPath: CatalogPathRef) {
    super();
    this.id = `npc.${family}.cow`;
    this.catalogPath = catalogPath;
  }
}

export class ChickenArchetype extends BaseNpcArchetype {
  protected readonly id: string;
  protected readonly label = "chicken";
  protected readonly catalogPath: CatalogPathRef;

  public constructor(family: string, catalogPath: CatalogPathRef) {
    super();
    this.id = `npc.${family}.chicken`;
    this.catalogPath = catalogPath;
  }
}

export class BatArchetype extends BaseNpcArchetype {
  protected readonly id: string;
  protected readonly label = "bat";
  protected readonly catalogPath: CatalogPathRef;

  public constructor(family: string, catalogPath: CatalogPathRef) {
    super();
    this.id = `npc.${family}.bat`;
    this.catalogPath = catalogPath;
  }
}

function npcArchetypeFromMobId(
  mobId: NpcPlaceableId,
  family: string,
  catalogPath: CatalogPathRef,
): BaseNpcArchetype {
  switch (mobId) {
    case "cow": return new CowArchetype(family, catalogPath);
    case "chicken": return new ChickenArchetype(family, catalogPath);
    case "bat": return new BatArchetype(family, catalogPath);
  }
}

export function buildArchetypeRuntimes(input: BuildArchetypeRuntimesInput): ArchetypeRuntime[] {
  const runtimes: ArchetypeRuntime[] = [];
  const seenNpcCatalogPaths = new Set<string>();

  for (const player of input.players) {
    runtimes.push(new PlayerArchetype(player.model, player.catalogPath).toRuntime());
  }

  // Scope intentionally limited in this refactor:
  // only known NPC mobs are placeable. Tiles/props are planned later.
  for (const npc of input.npcs) {
    const pathKey = npc.catalogPath.value;
    if (seenNpcCatalogPaths.has(pathKey)) continue;
    seenNpcCatalogPaths.add(pathKey);
    runtimes.push(npcArchetypeFromMobId(npc.mobId, npc.family, npc.catalogPath).toRuntime());
  }

  return runtimes;
}
