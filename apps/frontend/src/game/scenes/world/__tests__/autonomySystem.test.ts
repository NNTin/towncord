import { describe, expect, test } from "vitest";
import {
  AUTONOMY_IDLE_DELAY_MS,
  createAutonomyState,
  resetEntityAutonomy,
  updateEntityAutonomy,
} from "../autonomySystem";
import type { WorldNavigationService } from "../navigation";
import type { WorldEntity } from "../types";

function createEntity(overrides?: Partial<WorldEntity>): WorldEntity {
  return {
    id: 1,
    entityId: "npc.test",
    definition: {
      id: "npc.test",
      label: "test",
      kind: "npc",
      visualRef: { value: "mobs/animals/chicken" },
      capabilities: ["idle", "walk"],
      placeable: true,
    },
    behavior: {
      idle: () => "idle",
      walk: () => "walk",
    },
    position: { x: 100, y: 200 },
    velocity: { x: 0, y: 0 },
    facing: "down",
    state: "idle",
    animationAction: "idle",
    autonomy: createAutonomyState(["sleep", "eat"]),
    sprite: {} as WorldEntity["sprite"],
    ...overrides,
  };
}

const navigation: WorldNavigationService = {
  pickWanderTarget(subject) {
    return { x: subject.position.x + 64, y: subject.position.y };
  },
  getStepToward() {
    return { moveX: 1, moveY: 0, reached: false };
  },
  planPath(_subject, target) {
    return {
      waypoints: [target],
      revision: 1,
    };
  },
  isPathValid() {
    return true;
  },
  clampToBounds(point) {
    return point;
  },
  isWalkable() {
    return true;
  },
};

describe("autonomySystem", () => {
  test("does nothing before inactivity gate opens", () => {
    const entity = createEntity();
    const input = updateEntityAutonomy(entity, AUTONOMY_IDLE_DELAY_MS, {
      autoplayEnabled: false,
      navigation,
      rng: () => 0,
    });

    expect(input).toEqual({ moveX: 0, moveY: 0, isRunModifier: false });
    expect(entity.autonomy.wanderTarget).toBeNull();
    expect(entity.autonomy.path).toEqual([]);
    expect(entity.animationAction).toBe("idle");
  });

  test("starts wandering once autonomy is enabled", () => {
    const entity = createEntity();
    const first = updateEntityAutonomy(entity, 400, {
      autoplayEnabled: true,
      navigation,
      rng: () => 0.9,
    });

    expect(first).toEqual({ moveX: 1, moveY: 0, isRunModifier: false });
    expect(entity.autonomy.wanderTarget).not.toBeNull();
    expect(entity.autonomy.path).toHaveLength(1);
  });

  test("can choose an ambient action when available", () => {
    const entity = createEntity();
    const input = updateEntityAutonomy(entity, 400, {
      autoplayEnabled: true,
      navigation,
      rng: () => 0,
    });

    expect(input).toEqual({ moveX: 0, moveY: 0, isRunModifier: false });
    expect(entity.autonomy.currentAmbientAction).toBe("sleep");
    expect(entity.animationAction).toBe("sleep");
  });

  test("reset clears transient autonomy state", () => {
    const entity = createEntity();
    entity.autonomy.currentAmbientAction = "sleep";
    entity.autonomy.currentAmbientMs = 500;
    entity.autonomy.wanderTarget = { x: 10, y: 20 };
    entity.autonomy.path = [{ x: 12, y: 20 }];
    entity.autonomy.pathIndex = 1;
    entity.autonomy.pathRevision = 4;
    entity.animationAction = "sleep";

    resetEntityAutonomy(entity);

    expect(entity.autonomy.currentAmbientAction).toBeNull();
    expect(entity.autonomy.currentAmbientMs).toBe(0);
    expect(entity.autonomy.wanderTarget).toBeNull();
    expect(entity.autonomy.path).toEqual([]);
    expect(entity.autonomy.pathIndex).toBe(0);
    expect(entity.autonomy.pathRevision).toBeNull();
    expect(entity.animationAction).toBe("idle");
  });
});
