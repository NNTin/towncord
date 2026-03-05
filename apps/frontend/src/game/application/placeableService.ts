import { type EntityRegistry } from "../domain/entityRegistry";
import type { EntityDefinition, EntityId } from "../domain/model";
import type { PlaceDragPayload } from "../events";

export type PlaceableViewModel = {
  entityId: EntityId;
  label: string;
  kind: EntityDefinition["kind"];
};

export class PlaceableService {
  private constructor(private readonly registry: EntityRegistry) {}

  public static fromRegistry(registry: EntityRegistry): PlaceableService {
    return new PlaceableService(registry);
  }

  public listPlaceables(): PlaceableViewModel[] {
    // Scope intentionally constrained in this refactor:
    // placeables are NPCs and player models only. Tiles/props come later.
    return this.registry
      .listPlaceables()
      .map((definition) => ({
        entityId: definition.id,
        label: definition.label,
        kind: definition.kind,
      }));
  }

  public toDragPayload(entityId: EntityId): PlaceDragPayload | null {
    const definition = this.registry.getById(entityId);
    if (!definition || !definition.placeable) return null;
    return {
      entityId: definition.id,
    };
  }
}
