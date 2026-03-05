import type { AnimationCatalog } from "../assets/animationCatalog";
import { buildArchetypeDefinitions } from "./archetypes";
import type { EntityDefinition, EntityId } from "./model";

export interface EntityRegistry {
  getById(entityId: EntityId): EntityDefinition | null;
  listPlaceables(): EntityDefinition[];
}

export class CatalogEntityRegistry implements EntityRegistry {
  private readonly byId: Map<EntityId, EntityDefinition>;

  private constructor(definitions: EntityDefinition[]) {
    this.byId = new Map(definitions.map((definition) => [definition.id, definition]));
  }

  public static fromCatalog(catalog: AnimationCatalog): CatalogEntityRegistry {
    return new CatalogEntityRegistry(buildArchetypeDefinitions(catalog));
  }

  public getById(entityId: EntityId): EntityDefinition | null {
    return this.byId.get(entityId) ?? null;
  }

  public listPlaceables(): EntityDefinition[] {
    return [...this.byId.values()].filter((definition) => definition.placeable);
  }
}
