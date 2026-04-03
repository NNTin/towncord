import type Phaser from "phaser";
import {
  type AnimationCatalog,
  type AnimationTrack,
  getTracksForPath,
  resolveTrackForDirection,
} from "../../content/asset-catalog/animationCatalog";
import {
  readEntityVisualRef,
  readEntityVisualTrackId,
  type EntityDefinition,
} from "../../world/entities/model";
import {
  isLocomotionTrackId,
  resolveTrackByActionPolicy,
} from "./animationPolicy";
import type { WorldAnimatedActor } from "./types";

type SpawnVisual = {
  animationKey: string;
  flipX: boolean;
  textureKey: string;
  textureFrame: string | number;
};

function resolveEntityTrack(
  catalog: AnimationCatalog,
  definition: EntityDefinition,
  action: string,
): AnimationTrack | null {
  const tracks = getTracksForPath(
    catalog,
    readEntityVisualRef(definition.visualRef),
  );
  const preferredTrackId = readEntityVisualTrackId(definition.visualRef);

  if (preferredTrackId) {
    return tracks.find((track) => track.id === preferredTrackId) ?? null;
  }

  return resolveTrackByActionPolicy(tracks, action) ?? tracks[0] ?? null;
}

export function resolveAmbientActionIds(
  catalog: AnimationCatalog,
  definition: EntityDefinition,
): string[] {
  if (readEntityVisualTrackId(definition.visualRef)) {
    return [];
  }

  if (definition.kind !== "npc") return [];

  return getTracksForPath(catalog, readEntityVisualRef(definition.visualRef))
    .map((track) => track.id)
    .filter((trackId) => !isLocomotionTrackId(trackId));
}

export function resolveSpawnVisual(
  catalog: AnimationCatalog,
  anims: Phaser.Animations.AnimationManager,
  definition: EntityDefinition,
): SpawnVisual | null {
  const idleTrack = resolveEntityTrack(catalog, definition, "idle");
  if (!idleTrack) return null;

  const resolved = resolveTrackForDirection(idleTrack, "down");
  if (!resolved) return null;

  const firstFrame = anims.get(resolved.key)?.frames[0];
  if (!firstFrame) return null;

  return {
    animationKey: resolved.key,
    flipX: resolved.flipX,
    textureKey: firstFrame.textureKey,
    textureFrame: firstFrame.textureFrame,
  };
}

export function playEntityAnimation(
  entity: WorldAnimatedActor,
  catalog: AnimationCatalog,
): void {
  const track = resolveEntityTrack(
    catalog,
    entity.definition,
    entity.animationAction,
  );
  if (!track) return;

  const resolved = resolveTrackForDirection(track, entity.facing);
  if (!resolved) return;

  let flipX = resolved.flipX;
  // Undirected NPC tracks should keep last horizontal facing on up/down.
  if (entity.definition.kind === "npc" && !track.directional) {
    if (entity.facing === "left") {
      flipX = true;
    } else if (entity.facing === "right") {
      flipX = false;
    } else {
      flipX = entity.sprite.flipX;
    }
  }

  entity.sprite.setFlipX(flipX);
  entity.sprite.play(resolved.key, true);
}
