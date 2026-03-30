import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock(
  "../../../application/runtime-compilation/load-plans/runtimeBootstrap",
  () => ({
    WORLD_BOOTSTRAP_REGISTRY_KEY: "worldBootstrap",
    composeRuntimeBootstrap: vi.fn(),
  }),
);

vi.mock("../../transport/runtimeEvents", () => ({
  RUNTIME_TO_UI_EVENTS: { RUNTIME_READY: "runtimeReady" },
  emitRuntimeToUiEvent: vi.fn(),
}));

vi.mock(
  "../../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap",
  () => ({
    OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY: "officeSceneBootstrap",
    createOfficeSceneBootstrap: vi.fn(),
  }),
);

vi.mock("../../../content/preload/animation", () => ({
  registerPreloadAnimations: vi.fn(),
}));

vi.mock("../../../content/preload/preload", () => ({
  preloadBloomseedPack: vi.fn(),
  preloadDebugPack: vi.fn(),
  preloadDonargOfficePack: vi.fn(),
  preloadFarmrpgPack: vi.fn(),
}));

import { createWorldRuntimePreloadLifecycle } from "../createWorldRuntimePreloadLifecycle";
import {
  WORLD_BOOTSTRAP_REGISTRY_KEY,
  composeRuntimeBootstrap,
} from "../../../application/runtime-compilation/load-plans/runtimeBootstrap";
import {
  RUNTIME_TO_UI_EVENTS,
  emitRuntimeToUiEvent,
} from "../../transport/runtimeEvents";
import {
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
  createOfficeSceneBootstrap,
} from "../../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap";
import { registerPreloadAnimations } from "../../../content/preload/animation";
import {
  preloadBloomseedPack,
  preloadDebugPack,
  preloadDonargOfficePack,
  preloadFarmrpgPack,
} from "../../../content/preload/preload";

function makeScene() {
  const registryMap = new Map<string, unknown>();
  return {
    game: { events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } },
    registry: {
      set: vi.fn((key: string, value: unknown) => registryMap.set(key, value)),
      get: vi.fn((key: string) => registryMap.get(key)),
    },
    scene: { start: vi.fn() },
  };
}

describe("createWorldRuntimePreloadLifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("preload() queues all four asset packs", () => {
    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();

    adapter.preload(scene as never);

    expect(preloadBloomseedPack).toHaveBeenCalledWith(scene);
    expect(preloadDebugPack).toHaveBeenCalledWith(scene);
    expect(preloadDonargOfficePack).toHaveBeenCalledWith(scene);
    expect(preloadFarmrpgPack).toHaveBeenCalledWith(scene);
  });

  test("create() registers preload animations before composing bootstrap", () => {
    const callOrder: string[] = [];
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        callOrder.push("registerPreloadAnimations");
        return { animationKeys: ["key1", "key2"] };
      },
    );
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        callOrder.push("composeRuntimeBootstrap");
        return { world: {}, ui: { catalog: {}, placeables: [] } };
      },
    );
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(callOrder.indexOf("registerPreloadAnimations")).toBeLessThan(
      callOrder.indexOf("composeRuntimeBootstrap"),
    );
  });

  test("create() passes animation keys to composeRuntimeBootstrap", () => {
    const animationKeys = ["anim:player:idle:down", "anim:player:walk:down"];
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys,
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: {},
      ui: { catalog: {}, placeables: [] },
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(composeRuntimeBootstrap).toHaveBeenCalledWith(animationKeys);
  });

  test("create() publishes world bootstrap to scene registry", () => {
    const worldBootstrap = { catalog: { entityTypes: [] }, entityRegistry: {} };
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys: [],
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: worldBootstrap,
      ui: { catalog: {}, placeables: [] },
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(scene.registry.set).toHaveBeenCalledWith(
      WORLD_BOOTSTRAP_REGISTRY_KEY,
      worldBootstrap,
    );
  });

  test("create() publishes office bootstrap to scene registry", () => {
    const officeBootstrap = {
      anchor: {
        x: 1,
        y: 1,
      },
      layout: {
        cols: 10,
        rows: 8,
        cellSize: 16,
        tiles: [],
        furniture: [],
        characters: [],
      },
    };
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys: [],
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: {},
      ui: { catalog: {}, placeables: [] },
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue(
      officeBootstrap,
    );

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(scene.registry.set).toHaveBeenCalledWith(
      OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
      officeBootstrap,
    );
  });

  test("create() emits RUNTIME_READY with the UI bootstrap payload", () => {
    const uiPayload = { catalog: { entityTypes: [] }, placeables: [] };
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys: [],
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: {},
      ui: uiPayload,
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(emitRuntimeToUiEvent).toHaveBeenCalledWith(
      scene.game,
      RUNTIME_TO_UI_EVENTS.RUNTIME_READY,
      uiPayload,
    );
  });

  test("create() starts the world runtime scene after registry publication and RUNTIME_READY", () => {
    const callOrder: string[] = [];
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys: [],
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: {},
      ui: { catalog: {}, placeables: [] },
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });
    (emitRuntimeToUiEvent as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        callOrder.push("emitRuntimeReady");
      },
    );

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    (scene.registry.set as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => {
        callOrder.push(`set:${key}`);
      },
    );
    (scene.scene.start as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => {
        callOrder.push(`start:${key}`);
      },
    );

    adapter.create(scene as never);

    expect(scene.scene.start).toHaveBeenCalledWith("world");
    expect(callOrder.indexOf("set:worldBootstrap")).toBeLessThan(
      callOrder.indexOf("start:world"),
    );
    expect(callOrder.indexOf("set:officeSceneBootstrap")).toBeLessThan(
      callOrder.indexOf("start:world"),
    );
    expect(callOrder.indexOf("emitRuntimeReady")).toBeLessThan(
      callOrder.indexOf("start:world"),
    );
  });

  test("create() emits RUNTIME_READY exactly once", () => {
    (registerPreloadAnimations as ReturnType<typeof vi.fn>).mockReturnValue({
      animationKeys: [],
    });
    (composeRuntimeBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      world: {},
      ui: { catalog: {}, placeables: [] },
    });
    (createOfficeSceneBootstrap as ReturnType<typeof vi.fn>).mockReturnValue({
      anchor: { x: 1, y: 1 },
      layout: {},
    });

    const adapter = createWorldRuntimePreloadLifecycle();
    const scene = makeScene();
    adapter.create(scene as never);

    expect(emitRuntimeToUiEvent).toHaveBeenCalledTimes(1);
  });
});
