import { type EntityRegistry } from "../domain/entityRegistry";
import type { EntityId, EntityKind } from "../domain/model";
import { TERRAIN_PLACEABLES } from "../terrain/placeables";
import type { TerrainBrushId, TerrainMaterialId } from "../terrain/contracts";

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

export type EntityPlaceableViewModel = {
  id: string;
  type: "entity";
  entityId: EntityId;
  label: string;
  groupKey: string;
  groupLabel: string;
};

export type TerrainPlaceableViewModel = {
  id: string;
  type: "terrain";
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  label: string;
  groupKey: string;
  groupLabel: string;
};

export type PlaceableViewModel = EntityPlaceableViewModel | TerrainPlaceableViewModel;

export class PlaceableService {
  private constructor(private readonly registry: EntityRegistry) {}

  public static fromRegistry(registry: EntityRegistry): PlaceableService {
    return new PlaceableService(registry);
  }

  private listEntityPlaceables(): EntityPlaceableViewModel[] {
    return this.registry
      .listPlaceables()
      .map((definition) => ({
        id: `entity:${definition.id}`,
        type: "entity" as const,
        entityId: definition.id,
        label: definition.label,
        groupKey: `entity:${definition.kind}`,
        groupLabel: resolvePlaceableGroupLabel(definition.kind),
      }));
  }

  private listTerrainPlaceables(): TerrainPlaceableViewModel[] {
    return TERRAIN_PLACEABLES.map((placeable) => ({
      id: placeable.id,
      type: "terrain",
      label: placeable.label,
      materialId: placeable.materialId,
      brushId: placeable.brushId,
      groupKey: "terrain",
      groupLabel: "Terrain",
    }));
  }

  public listPlaceables(): PlaceableViewModel[] {
    return [...this.listEntityPlaceables(), ...this.listTerrainPlaceables()];
  }
}
