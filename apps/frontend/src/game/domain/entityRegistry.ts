import type { EntityBehavior } from "./capabilities";
import type { EntityDefinition, EntityId } from "./model";

export interface EntityRegistry {
  getById(entityId: EntityId): EntityDefinition | null;
  getRuntimeById(entityId: EntityId): RegisteredEntity | null;
  listPlaceables(): EntityDefinition[];
}

export type RegisteredEntity = {
  definition: EntityDefinition;
  createBehavior: () => EntityBehavior;
};

export class RuntimeEntityRegistry implements EntityRegistry {
  private readonly byId: Map<EntityId, RegisteredEntity>;

  private constructor(entities: RegisteredEntity[]) {
    this.byId = new Map(entities.map((entity) => [entity.definition.id, entity]));
  }

  public static fromRuntimes(runtimes: RegisteredEntity[]): RuntimeEntityRegistry {
    return new RuntimeEntityRegistry(runtimes);
  }

  public getById(entityId: EntityId): EntityDefinition | null {
    return this.byId.get(entityId)?.definition ?? null;
  }

  public getRuntimeById(entityId: EntityId): RegisteredEntity | null {
    return this.byId.get(entityId) ?? null;
  }

  public listPlaceables(): EntityDefinition[] {
    return [...this.byId.values()]
      .map((entity) => entity.definition)
      .filter((definition) => definition.placeable);
  }
}
