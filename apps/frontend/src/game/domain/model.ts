export type EntityId = string;
export type EntityKind = "player" | "npc";
export type EntityCapability = "idle" | "walk" | "run";
export type EntityAction = EntityCapability;

export type SpawnSpec = {
  entityId: EntityId;
  catalogPath: string;
};

export type EntityDefinition = {
  id: EntityId;
  label: string;
  kind: EntityKind;
  catalogPath: string;
  capabilities: readonly EntityCapability[];
  placeable: boolean;
};

export function hasCapability(
  definition: EntityDefinition,
  capability: EntityCapability,
): boolean {
  return definition.capabilities.includes(capability);
}
