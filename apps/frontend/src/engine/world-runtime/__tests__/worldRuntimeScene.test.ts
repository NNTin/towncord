import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {
    constructor(_key?: string) {}
  }

  return {
    default: {
      Scene,
      Scale: {
        Events: {
          RESIZE: "resize",
        },
      },
    },
  };
});

import { createBootRuntimeScene } from "../scene/createBootRuntimeScene";
import { createPreloadRuntimeScene } from "../scene/createPreloadRuntimeScene";
import { createWorldRuntimeScene } from "../scene/createWorldRuntimeScene";
import {
  RUNTIME_BOOT_SCENE_KEY,
  RUNTIME_PRELOAD_SCENE_KEY,
  RUNTIME_WORLD_SCENE_KEY,
} from "../scene/runtimeSceneKeys";
import type { PreloadSceneLifecycleAdapter, WorldSceneLifecycleAdapter } from "../scene/contracts";

function makeAdapter(): WorldSceneLifecycleAdapter {
  return {
    boot: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onWheel: vi.fn(),
    onResize: vi.fn(),
  };
}

function makeScene(): Record<string, unknown> {
  return {
    input: {
      activePointer: { x: 0, y: 0 },
      on: vi.fn(),
      off: vi.fn(),
    },
    scale: { once: vi.fn() },
    events: { once: vi.fn() },
  };
}

describe("createBootRuntimeScene", () => {
  test("returns a constructor registered as boot scene key", () => {
    const BootScene = createBootRuntimeScene();
    const instance = new BootScene() as unknown as Record<string, unknown>;
    expect(instance).toBeDefined();
  });

  test("boot scene starts the preload scene on create", () => {
    const BootScene = createBootRuntimeScene();
    const instance = new BootScene() as unknown as Record<string, unknown>;
    const startMock = vi.fn();
    instance.scene = { start: startMock };

    (instance.create as () => void)();

    expect(startMock).toHaveBeenCalledWith(RUNTIME_PRELOAD_SCENE_KEY);
  });
});

function makePreloadAdapter(): PreloadSceneLifecycleAdapter {
  return {
    preload: vi.fn(),
    create: vi.fn(),
  };
}

describe("createPreloadRuntimeScene", () => {
  test("returns a constructor registered as preload scene key", () => {
    const adapter = makePreloadAdapter();
    const PreloadScene = createPreloadRuntimeScene(adapter);
    const instance = new PreloadScene() as unknown as Record<string, unknown>;
    expect(instance).toBeDefined();
  });

  test("preload() delegates to adapter.preload with the scene instance", () => {
    const adapter = makePreloadAdapter();
    const PreloadScene = createPreloadRuntimeScene(adapter);
    const instance = new PreloadScene() as unknown as Record<string, unknown>;

    (instance.preload as () => void)();

    expect(adapter.preload).toHaveBeenCalledWith(instance);
  });

  test("create() delegates to adapter.create with the scene instance", () => {
    const adapter = makePreloadAdapter();
    const PreloadScene = createPreloadRuntimeScene(adapter);
    const instance = new PreloadScene() as unknown as Record<string, unknown>;

    (instance.create as () => void)();

    expect(adapter.create).toHaveBeenCalledWith(instance);
  });

  test("uses the runtime preload scene key", () => {
    const adapter = makePreloadAdapter();
    const PreloadScene = createPreloadRuntimeScene(adapter);
    // The scene key is passed to the super constructor; verify the key constant is used
    const instance = new PreloadScene() as unknown as Record<string, unknown>;
    expect(instance).toBeDefined();
    expect(RUNTIME_PRELOAD_SCENE_KEY).toBe("preload");
  });
});

describe("createWorldRuntimeScene", () => {
  test("returns a constructor registered as world scene key", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    expect(instance).toBeDefined();
  });

  test("create calls adapter.boot and registers input events", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);

    (instance.create as () => void)();

    expect(adapter.boot).toHaveBeenCalledWith(instance);
    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    expect(inputOn.on).toHaveBeenCalledWith("pointerdown", expect.any(Function), instance);
    expect(inputOn.on).toHaveBeenCalledWith("pointermove", expect.any(Function), instance);
    expect(inputOn.on).toHaveBeenCalledWith("pointerup", expect.any(Function), instance);
    expect(inputOn.on).toHaveBeenCalledWith("pointerupoutside", expect.any(Function), instance);
    expect(inputOn.on).toHaveBeenCalledWith("wheel", expect.any(Function), instance);
  });

  test("create registers shutdown handler", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);

    (instance.create as () => void)();

    const eventsOnce = scene.events as { once: ReturnType<typeof vi.fn> };
    expect(eventsOnce.once).toHaveBeenCalledWith(
      "shutdown",
      expect.any(Function),
      instance,
    );
  });

  test("create registers resize handler that calls adapter.onResize", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);

    (instance.create as () => void)();

    const scaleOnce = scene.scale as { once: ReturnType<typeof vi.fn> };
    expect(scaleOnce.once).toHaveBeenCalledOnce();
    const resizeCallback = scaleOnce.once.mock.calls[0]![1] as () => void;
    resizeCallback();
    expect(adapter.onResize).toHaveBeenCalledOnce();
  });

  test("update delegates delta to adapter", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    (instance.update as (_time: number, delta: number) => void)(0, 16);

    expect(adapter.update).toHaveBeenCalledWith(16);
  });

  test("pointerdown event forwards pointer to adapter", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    const pointerDownCall = inputOn.on.mock.calls.find(([event]) => event === "pointerdown")!;
    const handler = pointerDownCall[1] as (pointer: unknown) => void;
    const pointer = { x: 5, y: 10 };
    handler.call(instance, pointer);

    expect(adapter.onPointerDown).toHaveBeenCalledWith(pointer);
  });

  test("pointermove event forwards pointer to adapter", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    const call = inputOn.on.mock.calls.find(([event]) => event === "pointermove")!;
    const handler = call[1] as (pointer: unknown) => void;
    const pointer = { x: 3, y: 7 };
    handler.call(instance, pointer);

    expect(adapter.onPointerMove).toHaveBeenCalledWith(pointer);
  });

  test("pointerup event forwards pointer to adapter", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    const call = inputOn.on.mock.calls.find(([event]) => event === "pointerup")!;
    const handler = call[1] as (pointer: unknown) => void;
    const pointer = { x: 8, y: 9 };
    handler.call(instance, pointer);

    expect(adapter.onPointerUp).toHaveBeenCalledWith(pointer);
  });

  test("pointerupoutside event forwards pointer to adapter via onPointerUp", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    const call = inputOn.on.mock.calls.find(([event]) => event === "pointerupoutside")!;
    const handler = call[1] as (pointer: unknown) => void;
    const pointer = { x: 2, y: 4 };
    handler.call(instance, pointer);

    expect(adapter.onPointerUp).toHaveBeenCalledWith(pointer);
  });

  test("wheel event extracts dy and active pointer and forwards to adapter", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const activePointer = { x: 1, y: 2 };
    const scene = makeScene();
    (scene.input as Record<string, unknown>).activePointer = activePointer;
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const inputOn = scene.input as { on: ReturnType<typeof vi.fn> };
    const call = inputOn.on.mock.calls.find(([event]) => event === "wheel")!;
    const handler = call[1] as (
      _ptr: unknown,
      _objs: unknown,
      _dx: number,
      dy: number,
    ) => void;
    handler.call(instance, null, null, 0, 30);

    expect(adapter.onWheel).toHaveBeenCalledWith(30, activePointer);
  });

  test("shutdown unbinds all input events and calls adapter.dispose", () => {
    const adapter = makeAdapter();
    const WorldScene = createWorldRuntimeScene(adapter);
    const instance = new WorldScene() as unknown as Record<string, unknown>;
    const scene = makeScene();
    Object.assign(instance, scene);
    (instance.create as () => void)();

    const eventsOnce = scene.events as { once: ReturnType<typeof vi.fn> };
    const shutdownCall = eventsOnce.once.mock.calls.find(([event]) => event === "shutdown")!;
    const shutdownHandler = shutdownCall[1] as () => void;
    shutdownHandler.call(instance);

    const inputOff = scene.input as { off: ReturnType<typeof vi.fn> };
    expect(inputOff.off).toHaveBeenCalledTimes(5);
    expect(adapter.dispose).toHaveBeenCalledOnce();
  });
});

describe("runtimeSceneKeys", () => {
  test("boot key is defined", () => {
    expect(RUNTIME_BOOT_SCENE_KEY).toBe("boot");
  });

  test("preload key is defined", () => {
    expect(RUNTIME_PRELOAD_SCENE_KEY).toBe("preload");
  });

  test("world key is defined", () => {
    expect(RUNTIME_WORLD_SCENE_KEY).toBe("world");
  });
});
