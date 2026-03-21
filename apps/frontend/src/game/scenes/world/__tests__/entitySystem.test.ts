import { describe, expect, test, vi } from "vitest";
import type { AnimationCatalog } from "../../../assets/animationCatalog";
import { EntitySystem } from "../entitySystem";

const mocks = vi.hoisted(() => {
  const entityDestroy = vi.fn();
  const createWorldEntity = vi.fn(() => ({
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
    position: { x: 10, y: 20 },
    velocity: { x: 0, y: 0 },
    facing: "down",
    state: "idle",
    animationAction: "idle",
    autonomy: {
      currentAmbientAction: null,
      currentAmbientMs: 0,
      path: [],
      pathIndex: 0,
      pathRevision: null,
      wanderTarget: null,
    },
    sprite: {
      destroy: entityDestroy,
    },
  }));

  return { createWorldEntity, entityDestroy };
});

vi.mock("../entityFactory", () => ({
  createWorldEntity: mocks.createWorldEntity,
  WORLD_ENTITY_SPRITE_ORIGIN_Y: 0.5,
}));

describe("EntitySystem", () => {
  test("owns entity lifecycle and transient state", () => {
    const system = new EntitySystem({
      scene: {} as never,
      catalog: {} as AnimationCatalog,
      navigation: {} as never,
      emitGameEvent: vi.fn(),
      onSelectedEntityUpdated: vi.fn(),
    });

    const runtime = {
      definition: {
        id: "npc.test",
        label: "test",
        kind: "npc",
        visualRef: { value: "mobs/animals/chicken" },
        capabilities: ["idle", "walk"],
        placeable: true,
      },
      createBehavior: () => ({ movement: { walk: true } }) as never,
    } as never;

    const first = system.addEntity(runtime, 10, 20);
    system.select(first);
    expect(system.getSelected()).toBe(first);
    expect(system.getAll()).toHaveLength(1);
    expect(mocks.createWorldEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        nextId: 0,
        worldX: 10,
        worldY: 20,
      }),
    );

    const internalState = system as unknown as {
      nextId: number;
      directInputIdleMs: number;
    };
    internalState.nextId = 4;
    internalState.directInputIdleMs = 120;

    system.dispose();

    expect(mocks.entityDestroy).toHaveBeenCalledOnce();
    expect(system.getSelected()).toBeNull();
    expect(system.getAll()).toEqual([]);
    expect(internalState.nextId).toBe(0);
    expect(internalState.directInputIdleMs).toBe(0);
  });
});
