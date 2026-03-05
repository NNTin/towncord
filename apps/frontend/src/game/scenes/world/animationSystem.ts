import type Phaser from "phaser";
import {
  type AnimationCatalog,
  type AnimationTrack,
  getTracksForPath,
  resolveTrackForDirection,
} from "../../assets/animationCatalog";
import { getTrackCandidatesForAction } from "../../application/actionResolver";
import { readCatalogPath, type EntityAction, type EntityDefinition } from "../../domain/model";
import type { WorldEntity } from "./types";

export type SpawnVisual = {
  animationKey: string;
  flipX: boolean;
  textureKey: string;
  textureFrame: string | number;
};

export function resolveEntityTrack(
  catalog: AnimationCatalog,
  definition: EntityDefinition,
  action: EntityAction,
): AnimationTrack | null {
  const tracks = getTracksForPath(catalog, readCatalogPath(definition.catalogPath));
  const candidates = getTrackCandidatesForAction(action);

  for (const id of candidates) {
    const track = tracks.find((item) => item.id === id);
    if (track) return track;
  }

  return tracks[0] ?? null;
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
  entity: WorldEntity,
  catalog: AnimationCatalog,
): void {
  const track = resolveEntityTrack(catalog, entity.definition, entity.state);
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
