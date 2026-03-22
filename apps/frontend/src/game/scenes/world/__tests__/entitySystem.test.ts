import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AnimationCatalog } from "../../../assets/animationCatalog";
import { EntitySystem } from "../entitySystem";

const mocks = vi.hoisted(() => {
  const entityDestroy = vi.fn();
  const createWorldEntity = vi.fn((input: {
    runtime: {
      definition: {
        id: string;
        label: string;
        kind: "npc" | "player";
        visualRef: { value: string };
        capabilities: string[];
        placeable: boolean;
      };
    };
    worldX: number;
    worldY: number;
  }) => ({
    id: 1,
    entityId: input.runtime.definition.id,
    definition: input.runtime.definition,
    behavior: {
      idle: () => "idle",
      walk: () => "walk",
      run: () => "run",
    },
    position: { x: input.worldX, y: input.worldY },
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
      setDepth: vi.fn(),
      setPosition: vi.fn(),
    },
  }));
  const playEntityAnimation = vi.fn();
  const updateEntityAutonomy = vi.fn(() => ({
    moveX: 0,
    moveY: 0,
    isRunModifier: false,
  }));
  const updateEntityMovement = vi.fn();

  return {
    createWorldEntity,
    entityDestroy,
    playEntityAnimation,
    updateEntityAutonomy,
    updateEntityMovement,
  };
});

vi.mock("../entityFactory", () => ({
  createWorldEntity: mocks.createWorldEntity,
  WORLD_ENTITY_SPRITE_ORIGIN_Y: 0.5,
}));

vi.mock("../animationSystem", () => ({
  playEntityAnimation: mocks.playEntityAnimation,
}));

vi.mock("../autonomySystem", () => ({
  AUTONOMY_IDLE_DELAY_MS: 1_000,
  resetEntityAutonomy: vi.fn(),
  updateEntityAutonomy: mocks.updateEntityAutonomy,
}));

vi.mock("../movementSystem", () => ({
  updateEntityMovement: mocks.updateEntityMovement,
}));

describe("EntitySystem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("owns entity lifecycle and transient state", () => {
    const system = new EntitySystem({
      scene: {} as never,
      catalog: {} as AnimationCatalog,
      navigation: {} as never,
      emitPlayerStateChanged: vi.fn(),
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

  test("emits selected player state changes through the explicit player projection", () => {
    const emitPlayerStateChanged = vi.fn();
    const system = new EntitySystem({
      scene: {} as never,
      catalog: {} as AnimationCatalog,
      navigation: {
        clampToBounds: (point: { x: number; y: number }) => point,
        isWalkable: () => true,
      } as never,
      emitPlayerStateChanged,
      onSelectedEntityUpdated: vi.fn(),
    });

    mocks.updateEntityMovement.mockImplementation((entity) => {
      entity.state = "run";
      entity.animationAction = "run";
      entity.velocity.x = 10;
      entity.velocity.y = 0;
    });

    const runtime = {
      definition: {
        id: "player.test",
        label: "player",
        kind: "player",
        visualRef: { value: "player/test" },
        capabilities: ["idle", "run"],
        placeable: true,
      },
      createBehavior: () => ({ movement: { run: true } }) as never,
    } as never;

    const player = system.addEntity(runtime, 10, 20);
    system.select(player);
    system.update(16, { moveX: 0, moveY: 0, isRunModifier: false });

    expect(emitPlayerStateChanged).toHaveBeenCalledWith({ state: "run" });
    expect(mocks.playEntityAnimation).toHaveBeenCalledOnce();
  });
});
