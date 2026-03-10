import type { AnimationTrack } from "../../assets/animationCatalog";
import type { EntityAction } from "../../domain/model";

const ACTION_TRACK_CANDIDATES: Readonly<Record<EntityAction, readonly string[]>> = {
  idle: ["idle"],
  walk: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
};

export const LOCOMOTION_TRACK_IDS = new Set<string>(["idle", "walk", "run"]);

export function getTrackCandidatesForAction(action: EntityAction): readonly string[] {
  return ACTION_TRACK_CANDIDATES[action];
}

export function isLocomotionTrackId(actionId: string): boolean {
  return LOCOMOTION_TRACK_IDS.has(actionId);
}

export function resolveTrackByActionPolicy(
  tracks: readonly AnimationTrack[],
  action: string,
): AnimationTrack | null {
  const candidates = isLocomotionTrackId(action)
    ? getTrackCandidatesForAction(action as EntityAction)
    : [action, "idle"];

  for (const id of candidates) {
    const track = tracks.find((item) => item.id === id);
    if (track) return track;
  }

  return tracks[0] ?? null;
}
