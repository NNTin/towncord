import type { AnimationCatalog } from "../content/asset-catalog/animationCatalog";
import { getTracksForPath } from "../content/asset-catalog/animationCatalog";
import type { EntityRegistry } from "../world/entities/entityRegistry";
import type { EntityDefinition, EntityKind } from "../world/entities/model";
import {
  readEntityVisualRef,
  readEntityVisualTrackId,
} from "../world/entities/model";
import type { EntityPlaceableViewModel } from "../contracts/runtime";

export type {
  EntityPlaceableViewModel,
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "../contracts/runtime";

const KIND_LABEL_OVERRIDES: Record<string, string> = {
  npc: "Mobs",
  player: "Player",
  prop: "Props",
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

function resolvePropGroupSegments(
  entityId: string,
): { key: string; label: string } | null {
  const parts = entityId.split(".");
  if (parts.length < 4 || parts[0] !== "prop") {
    return null;
  }

  const group = parts[2];
  if (!group) {
    return null;
  }

  return {
    key: `entity:prop:${group}`,
    label: formatKindLabel(group),
  };
}

// Preferred preview animations in priority order. Enemies like the bat use
// "sleep" as their resting state instead of "idle".
const PREVIEW_TRACK_PRIORITY = ["idle", "sleep", "walk"];

function resolveEntityPreviewFrameKey(
  definition: EntityDefinition,
  catalog: AnimationCatalog,
): string | null {
  const tracks = getTracksForPath(
    catalog,
    readEntityVisualRef(definition.visualRef),
  );
  if (tracks.length === 0) return null;

  const preferredTrackId = readEntityVisualTrackId(definition.visualRef);
  const preferredTrack = preferredTrackId
    ? (tracks.find((track) => track.id === preferredTrackId) ?? null)
    : null;

  const candidates = [
    preferredTrack,
    ...PREVIEW_TRACK_PRIORITY.map((id) => tracks.find((t) => t.id === id)),
    tracks[0],
  ].filter(
    (track, index, allTracks): track is NonNullable<typeof track> =>
      Boolean(track) && allTracks.indexOf(track) === index,
  );

  for (const track of candidates) {
    const key =
      track.keyByDirection.down ??
      track.keyByDirection.side ??
      track.undirectedKey;
    if (key) return `${key}#0`;
  }
  return null;
}

export function listEntityPlaceables(
  registry: EntityRegistry,
  catalog: AnimationCatalog,
): EntityPlaceableViewModel[] {
  return registry.listPlaceables().map((definition) => {
    const propGroup = resolvePropGroupSegments(definition.id);

    return {
      id: `entity:${definition.id}`,
      type: "entity" as const,
      entityId: definition.id,
      label: definition.label,
      groupKey: propGroup?.key ?? `entity:${definition.kind}`,
      groupLabel:
        propGroup?.label ?? resolvePlaceableGroupLabel(definition.kind),
      previewFrameKey: resolveEntityPreviewFrameKey(definition, catalog),
    };
  });
}
