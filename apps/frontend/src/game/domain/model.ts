export type EntityId = string;
export type EntityKind = "player" | "npc";
export type EntityCapability = "idle" | "walk" | "run";
export type EntityAction = EntityCapability;

export type CatalogPathRef = {
  value: string;
};

export function createCatalogPathRef(value: string): CatalogPathRef {
  return { value };
}

export function readCatalogPath(ref: CatalogPathRef): string {
  return ref.value;
}

export type EntityDefinition = {
  id: EntityId;
  label: string;
  kind: EntityKind;
  catalogPath: CatalogPathRef;
  capabilities: readonly EntityCapability[];
  placeable: boolean;
};
