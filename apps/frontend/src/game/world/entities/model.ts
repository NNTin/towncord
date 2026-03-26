export type EntityId = string;
const KNOWN_ENTITY_KINDS = ["player", "npc"] as const;
export type KnownEntityKind = (typeof KNOWN_ENTITY_KINDS)[number];
export type EntityKind = KnownEntityKind | (string & {});
export type EntityCapability = "idle" | "walk" | "run";
export type EntityAction = EntityCapability;

export type EntityVisualRef = {
  value: string;
};

export function createEntityVisualRef(value: string): EntityVisualRef {
  return { value };
}

export function readEntityVisualRef(ref: EntityVisualRef): string {
  return ref.value;
}

export type EntityDefinition = {
  id: EntityId;
  label: string;
  kind: EntityKind;
  visualRef: EntityVisualRef;
  capabilities: readonly EntityCapability[];
  placeable: boolean;
};
