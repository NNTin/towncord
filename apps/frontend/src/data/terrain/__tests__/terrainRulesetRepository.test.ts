import { describe, expect, test } from "vitest";
import {
  TERRAIN_RULESET_REPOSITORY_UNAVAILABLE,
  terrainRulesetRepository,
} from "../terrainRulesetRepository";

describe("terrainRulesetRepository", () => {
  test("exposes an explicit unavailable repository until a real transport lands", async () => {
    expect(terrainRulesetRepository.id).toBe("terrain-ruleset-unavailable");
    expect(terrainRulesetRepository.isAvailable).toBe(false);
    expect(terrainRulesetRepository.unavailableReason).toBe(
      TERRAIN_RULESET_REPOSITORY_UNAVAILABLE,
    );
    await expect(terrainRulesetRepository.read()).rejects.toThrow(
      TERRAIN_RULESET_REPOSITORY_UNAVAILABLE,
    );
  });
});
