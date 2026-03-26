import { describe, expect, test } from "vitest";
import {
  TERRAIN_SEED_REPOSITORY_UNAVAILABLE,
  terrainSeedRepository,
} from "../terrainSeedRepository";

describe("terrainSeedRepository", () => {
  test("exposes an explicit unavailable repository until a real transport lands", async () => {
    expect(terrainSeedRepository.id).toBe("terrain-seed-unavailable");
    expect(terrainSeedRepository.isAvailable).toBe(false);
    expect(terrainSeedRepository.unavailableReason).toBe(
      TERRAIN_SEED_REPOSITORY_UNAVAILABLE,
    );
    await expect(terrainSeedRepository.read()).rejects.toThrow(
      TERRAIN_SEED_REPOSITORY_UNAVAILABLE,
    );
  });
});
