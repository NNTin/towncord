import { type EntityRegistry } from "../domain/entityRegistry";
import type { EntityDefinition, EntityId, EntityKind } from "../domain/model";

const KIND_LABEL_OVERRIDES: Record<string, string> = {
  npc: "Mobs",
  player: "Player",
};

function formatKindLabel(kind: string): string {
  return kind
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}

export function resolvePlaceableGroupLabel(kind: EntityKind): string {
  return KIND_LABEL_OVERRIDES[kind] ?? formatKindLabel(kind);
}

export type PlaceableViewModel = {
  entityId: EntityId;
  label: string;
  kind: EntityDefinition["kind"];
  groupLabel: string;
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
        groupLabel: resolvePlaceableGroupLabel(definition.kind),
      }));
  }
}
