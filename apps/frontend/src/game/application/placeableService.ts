import type { EntityRegistry } from "../world/entities/entityRegistry";
import type { EntityKind } from "../world/entities/model";
import type { EntityPlaceableViewModel } from "../contracts/runtime";

export type {
  EntityPlaceableViewModel,
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "../contracts/runtime";

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

function resolvePlaceableGroupLabel(kind: EntityKind): string {
  return KIND_LABEL_OVERRIDES[kind] ?? formatKindLabel(kind);
}

export function listEntityPlaceables(registry: EntityRegistry): EntityPlaceableViewModel[] {
  return registry.listPlaceables().map((definition) => ({
    id: `entity:${definition.id}`,
    type: "entity" as const,
    entityId: definition.id,
    label: definition.label,
    groupKey: `entity:${definition.kind}`,
    groupLabel: resolvePlaceableGroupLabel(definition.kind),
  }));
}
