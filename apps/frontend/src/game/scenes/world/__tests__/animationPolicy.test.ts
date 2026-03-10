import { describe, expect, test } from "vitest";
import { resolveTrackByActionPolicy } from "../animationPolicy";
import type { AnimationTrack } from "../../../assets/animationCatalog";

const TRACKS: AnimationTrack[] = [
  {
    id: "idle",
    label: "idle",
    entityType: "mobs",
    directional: false,
    keyByDirection: {},
    undirectedKey: "idle-key",
    equipmentCompatible: [],
  },
  {
    id: "walk",
    label: "walk",
    entityType: "mobs",
    directional: false,
    keyByDirection: {},
    undirectedKey: "walk-key",
    equipmentCompatible: [],
  },
  {
    id: "sleep",
    label: "sleep",
    entityType: "mobs",
    directional: false,
    keyByDirection: {},
    undirectedKey: "sleep-key",
    equipmentCompatible: [],
  },
];

describe("animationPolicy", () => {
  test("resolves locomotion tracks with fallback policy", () => {
    expect(resolveTrackByActionPolicy(TRACKS, "run")?.id).toBe("walk");
  });

  test("resolves exact ambient actions when present", () => {
    expect(resolveTrackByActionPolicy(TRACKS, "sleep")?.id).toBe("sleep");
  });

  test("falls back to idle for unsupported ambient actions", () => {
    expect(resolveTrackByActionPolicy(TRACKS, "attack")?.id).toBe("idle");
  });
});
