import type Phaser from "phaser";
import {
  type AnimationCatalog,
  type AnimationTrack,
  getTracksForPath,
  resolveTrackForDirection,
} from "../../assets/animationCatalog";
import { supportsAmbientActions, type EntityBehavior } from "../../domain/capabilities";
import { readEntityVisualRef, type EntityDefinition } from "../../domain/model";
import { isLocomotionTrackId, resolveTrackByActionPolicy } from "./animationPolicy";
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
  action: string,
): AnimationTrack | null {
  const tracks = getTracksForPath(catalog, readEntityVisualRef(definition.visualRef));
  return resolveTrackByActionPolicy(tracks, action);
}

export function resolveAmbientActionIds(
  catalog: AnimationCatalog,
  definition: EntityDefinition,
  behavior: EntityBehavior,
): string[] {
  if (!supportsAmbientActions(behavior)) return [];

  const availableActionIds = getTracksForPath(catalog, readEntityVisualRef(definition.visualRef))
    .map((track) => track.id)
    .filter((trackId) => !isLocomotionTrackId(trackId));

  return [...behavior.listAmbientActionIds(availableActionIds)];
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
  const track = resolveEntityTrack(catalog, entity.definition, entity.animationAction);
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
