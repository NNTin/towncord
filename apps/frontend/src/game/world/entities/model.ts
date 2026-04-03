export type EntityId = string;
const KNOWN_ENTITY_KINDS = ["player", "npc", "prop"] as const;
export type KnownEntityKind = (typeof KNOWN_ENTITY_KINDS)[number];
export type EntityKind = KnownEntityKind | (string & {});
export type EntityCapability = "idle" | "walk" | "run";
export type EntityAction = EntityCapability;

export type EntityVisualRef = {
  value: string;
  trackId?: string;
};

export function createEntityVisualRef(
  value: string,
  trackId?: string,
): EntityVisualRef {
  return trackId ? { value, trackId } : { value };
}

export function readEntityVisualRef(ref: EntityVisualRef): string {
  return ref.value;
}

export function readEntityVisualTrackId(ref: EntityVisualRef): string | null {
  if (typeof ref.trackId !== "string" || ref.trackId.length === 0) {
    return null;
  }

  return ref.trackId;
}

export type EntityDefinition = {
  id: EntityId;
  label: string;
  kind: EntityKind;
  visualRef: EntityVisualRef;
  capabilities: readonly EntityCapability[];
  placeable: boolean;
};
