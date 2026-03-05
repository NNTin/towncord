import type { AnimationCatalog } from "../assets/animationCatalog";
import type { CanBePlaced, CanIdle, CanRun, CanWalk, ActionContext } from "./capabilities";
import type { EntityAction, EntityCapability, EntityDefinition, SpawnSpec } from "./model";

const NPC_PLACEABLE_IDS = new Set(["chicken", "cow", "bat"]);

abstract class BaseArchetype implements CanBePlaced {
  protected abstract readonly id: string;
  protected abstract readonly label: string;
  protected abstract readonly kind: "player" | "npc";
  protected abstract readonly catalogPath: string;
  protected abstract readonly capabilities: readonly EntityCapability[];

  public toDefinition(): EntityDefinition {
    return {
      id: this.id,
      label: this.label,
      kind: this.kind,
      catalogPath: this.catalogPath,
      capabilities: this.capabilities,
      placeable: true,
    };
  }

  public createSpawnSpec(): SpawnSpec {
    return { entityId: this.id, catalogPath: this.catalogPath };
  }
}

export class PlayerArchetype extends BaseArchetype implements CanIdle, CanWalk, CanRun {
  protected readonly id: string;
  protected readonly label: string;
  protected readonly kind = "player" as const;
  protected readonly catalogPath: string;
  protected readonly capabilities: readonly EntityCapability[] = ["idle", "walk", "run"];

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
  protected readonly capabilities: readonly EntityCapability[] = ["idle", "walk"];

  public idle(_ctx: ActionContext): EntityAction {
    return "idle";
  }

  public walk(_ctx: ActionContext): EntityAction {
    return "walk";
  }
}

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

export function buildArchetypeDefinitions(catalog: AnimationCatalog): EntityDefinition[] {
  const definitions: EntityDefinition[] = [];

  for (const model of catalog.playerModels) {
    definitions.push(new PlayerArchetype(model).toDefinition());
  }

  // Scope intentionally limited in this refactor:
  // only known NPC mobs are placeable. Tiles/props are planned later.
  for (const path of catalog.tracksByPath.keys()) {
    if (!path.startsWith("mobs/")) continue;
    const [, family, mobId] = path.split("/");
    if (!family || !mobId || !NPC_PLACEABLE_IDS.has(mobId)) continue;
    if (definitions.some((definition) => definition.catalogPath === path)) continue;
    const archetype = npcArchetypeFromMobId(mobId, family, path);
    if (archetype) {
      definitions.push(archetype.toDefinition());
    }
  }

  return definitions;
}
