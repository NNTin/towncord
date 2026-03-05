import type { AnimationTrack } from "../../assets/animationCatalog";
import type { EntityAction } from "../../domain/model";

const ACTION_TRACK_CANDIDATES: Readonly<Record<EntityAction, readonly string[]>> = {
  idle: ["idle"],
  walk: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
};

export function getTrackCandidatesForAction(action: EntityAction): readonly string[] {
  return ACTION_TRACK_CANDIDATES[action];
}

export function resolveTrackByActionPolicy(
  tracks: readonly AnimationTrack[],
  action: EntityAction,
): AnimationTrack | null {
  const candidates = getTrackCandidatesForAction(action);

  for (const id of candidates) {
    const track = tracks.find((item) => item.id === id);
    if (track) return track;
  }

  return tracks[0] ?? null;
}
