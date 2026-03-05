import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  deriveCapabilitiesFromBehavior,
  type ActionContext,
  type CanBePlaced,
  type CanIdle,
  type CanRun,
  type CanWalk,
  type EntityBehavior,
} from "./capabilities";
import type { EntityAction, EntityDefinition, SpawnSpec } from "./model";

const NPC_PLACEABLE_IDS = new Set(["chicken", "cow", "bat"]);

abstract class BaseArchetype implements CanBePlaced {
  protected abstract readonly id: string;
  protected abstract readonly label: string;
  protected abstract readonly kind: "player" | "npc";
  protected abstract readonly catalogPath: string;

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
  protected readonly catalogPath: string;

  public constructor(model: string) {
    super();
    this.id = `player.${model}`;
    this.label = model;
    this.catalogPath = `player/${model}`;
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
  protected readonly catalogPath: string;

  public constructor(family: string, catalogPath: string) {
    super();
    this.id = `npc.${family}.cow`;
    this.catalogPath = catalogPath;
  }
}

export class ChickenArchetype extends BaseNpcArchetype {
  protected readonly id: string;
  protected readonly label = "chicken";
  protected readonly catalogPath: string;

  public constructor(family: string, catalogPath: string) {
    super();
    this.id = `npc.${family}.chicken`;
    this.catalogPath = catalogPath;
  }
}

export class BatArchetype extends BaseNpcArchetype {
  protected readonly id: string;
  protected readonly label = "bat";
  protected readonly catalogPath: string;

  public constructor(family: string, catalogPath: string) {
    super();
    this.id = `npc.${family}.bat`;
    this.catalogPath = catalogPath;
  }
}

function npcArchetypeFromMobId(
  mobId: string,
  family: string,
  catalogPath: string,
): BaseNpcArchetype | null {
  switch (mobId) {
    case "cow": return new CowArchetype(family, catalogPath);
    case "chicken": return new ChickenArchetype(family, catalogPath);
    case "bat": return new BatArchetype(family, catalogPath);
    default: return null;
  }
}

export function buildArchetypeRuntimes(catalog: AnimationCatalog): ArchetypeRuntime[] {
  const runtimes: ArchetypeRuntime[] = [];

  for (const model of catalog.playerModels) {
    runtimes.push(new PlayerArchetype(model).toRuntime());
  }

  // Scope intentionally limited in this refactor:
  // only known NPC mobs are placeable. Tiles/props are planned later.
  for (const path of catalog.tracksByPath.keys()) {
    if (!path.startsWith("mobs/")) continue;
    const [, family, mobId] = path.split("/");
    if (!family || !mobId || !NPC_PLACEABLE_IDS.has(mobId)) continue;
    if (runtimes.some((runtime) => runtime.definition.catalogPath === path)) continue;
    const archetype = npcArchetypeFromMobId(mobId, family, path);
    if (archetype) {
      runtimes.push(archetype.toRuntime());
    }
  }

  return runtimes;
}
