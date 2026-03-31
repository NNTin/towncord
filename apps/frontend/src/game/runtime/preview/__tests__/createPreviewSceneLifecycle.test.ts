import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../content/preload/preload", () => ({
  preloadBloomseedPack: vi.fn(),
  preloadDebugPack: vi.fn(),
  preloadFarmrpgPack: vi.fn(),
}));

vi.mock("../../../content/preload/animation", () => ({
  registerBloomseedAnimations: vi.fn(),
  registerFarmrpgAnimations: vi.fn(),
}));

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value)),
    },
  },
}));

import { createPreviewSceneLifecycle } from "../createPreviewSceneLifecycle";
import {
  preloadBloomseedPack,
  preloadDebugPack,
} from "../../../content/preload/preload";
import { registerBloomseedAnimations } from "../../../content/preload/animation";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
} from "../../transport/previewEvents";

function makeScene() {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  const sprites: Array<{
    setScale: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    setTexture: ReturnType<typeof vi.fn>;
    setFlip: ReturnType<typeof vi.fn>;
    setFlipX: ReturnType<typeof vi.fn>;
    setRotation: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  function makeSprite() {
    const s = {
      setScale: vi.fn(),
      setPosition: vi.fn(),
      setTexture: vi.fn(),
      setFlip: vi.fn(),
      setFlipX: vi.fn(),
      setRotation: vi.fn(),
      setVisible: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
    };
    sprites.push(s);
    return s;
  }

  return {
    sprites,
    scene: {
      scale: { width: 164, height: 130 },
      add: {
        sprite: vi.fn(() => makeSprite()),
      },
      anims: {
        get: vi.fn(),
        exists: vi.fn(),
      },
      textures: {
        exists: vi.fn(),
        get: vi.fn(),
      },
      game: {
        events: {
          emit: vi.fn((event: string, payload?: unknown) => {
            for (const handler of listeners.get(event) ?? []) {
              handler(payload);
            }
          }),
          on: vi.fn((event: string, handler: (payload: unknown) => void) => {
            if (!listeners.has(event)) {
              listeners.set(event, []);
            }
            listeners.get(event)!.push(handler);
          }),
          off: vi.fn((event: string, handler: (payload: unknown) => void) => {
            const handlers = listeners.get(event);
            if (handlers) {
              const idx = handlers.indexOf(handler);
              if (idx !== -1) handlers.splice(idx, 1);
            }
          }),
        },
      },
    },
  };
}

describe("createPreviewSceneLifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("preload() queues bloomseed and debug packs", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    adapter.preload(scene as never);

    expect(preloadBloomseedPack).toHaveBeenCalledWith(scene);
    expect(preloadDebugPack).toHaveBeenCalledWith(scene);
  });

  test("preload() does not queue donarg office pack", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    adapter.preload(scene as never);

    expect(preloadBloomseedPack).toHaveBeenCalledTimes(1);
    expect(preloadDebugPack).toHaveBeenCalledTimes(1);
  });

  test("create() registers bloomseed animations before emitting ready", () => {
    const callOrder: string[] = [];
    (
      registerBloomseedAnimations as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      callOrder.push("registerAnimations");
    });

    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();
    (scene.game.events.emit as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string) => {
        callOrder.push(`emit:${event}`);
      },
    );

    adapter.create(scene as never);

    expect(callOrder.indexOf("registerAnimations")).toBeLessThan(
      callOrder.indexOf(`emit:${PREVIEW_READY_EVENT}`),
    );
  });

  test("create() emits PREVIEW_READY_EVENT exactly once", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    adapter.create(scene as never);

    expect(scene.game.events.emit).toHaveBeenCalledWith(PREVIEW_READY_EVENT);
    const readyCalls = (
      scene.game.events.emit as ReturnType<typeof vi.fn>
    ).mock.calls.filter((args) => args[0] === PREVIEW_READY_EVENT);
    expect(readyCalls).toHaveLength(1);
  });

  test("create() binds PREVIEW_PLAY_EVENT and PREVIEW_SHOW_TILE_EVENT listeners", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    adapter.create(scene as never);

    expect(scene.game.events.on).toHaveBeenCalledWith(
      PREVIEW_PLAY_EVENT,
      expect.any(Function),
    );
    expect(scene.game.events.on).toHaveBeenCalledWith(
      PREVIEW_SHOW_TILE_EVENT,
      expect.any(Function),
    );
  });

  test("dispose() unbinds play and show-tile listeners", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    adapter.create(scene as never);

    const onCalls = (scene.game.events.on as ReturnType<typeof vi.fn>).mock
      .calls;
    const playHandler = onCalls.find(
      (args) => args[0] === PREVIEW_PLAY_EVENT,
    )?.[1];
    const tileHandler = onCalls.find(
      (args) => args[0] === PREVIEW_SHOW_TILE_EVENT,
    )?.[1];

    adapter.dispose();

    expect(scene.game.events.off).toHaveBeenCalledWith(
      PREVIEW_PLAY_EVENT,
      playHandler,
    );
    expect(scene.game.events.off).toHaveBeenCalledWith(
      PREVIEW_SHOW_TILE_EVENT,
      tileHandler,
    );
  });

  test("dispose() can be called without create() without throwing", () => {
    const adapter = createPreviewSceneLifecycle();
    expect(() => adapter.dispose()).not.toThrow();
  });

  test("PREVIEW_PLAY_EVENT handler emits PREVIEW_INFO_EVENT with animation info", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    const animationFrames = [
      { textureKey: "bloomseed.characters", textureFrame: "player_idle_0" },
    ];
    const animation = {
      frames: animationFrames,
    };
    (scene.anims.get as ReturnType<typeof vi.fn>).mockReturnValue(animation);

    const frameObj = { width: 32, height: 48 };
    const textureObj = { get: vi.fn().mockReturnValue(frameObj) };
    (scene.textures.get as ReturnType<typeof vi.fn>).mockReturnValue(
      textureObj,
    );
    (scene.anims.exists as ReturnType<typeof vi.fn>).mockReturnValue(false);

    adapter.create(scene as never);
    vi.mocked(scene.game.events.emit).mockClear();

    scene.game.events.emit(PREVIEW_PLAY_EVENT, {
      key: "player:idle",
      flipX: false,
      equipKey: null,
      equipFlipX: false,
      frameIndex: null,
    });

    expect(scene.game.events.emit).toHaveBeenCalledWith(
      PREVIEW_INFO_EVENT,
      expect.objectContaining({
        sourceType: "animation",
        animationKey: "player:idle",
        frameWidth: 32,
        frameHeight: 48,
        frameCount: 1,
        flipX: false,
        flipY: false,
        scale: 3,
      }),
    );
  });

  test("PREVIEW_SHOW_TILE_EVENT handler emits PREVIEW_INFO_EVENT with terrain-tile info", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    const resolvedFrame = { width: 16, height: 16 };
    const textureObj = { get: vi.fn().mockReturnValue(resolvedFrame) };
    (scene.textures.exists as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (scene.textures.get as ReturnType<typeof vi.fn>).mockReturnValue(
      textureObj,
    );

    adapter.create(scene as never);
    vi.mocked(scene.game.events.emit).mockClear();

    scene.game.events.emit(PREVIEW_SHOW_TILE_EVENT, {
      textureKey: "debug.tilesets",
      frame: "grass_0",
      caseId: 2,
      materialId: "grass",
      cellX: 4,
      cellY: 6,
      rotate90: 0,
      flipX: false,
      flipY: false,
    });

    expect(scene.game.events.emit).toHaveBeenCalledWith(
      PREVIEW_INFO_EVENT,
      expect.objectContaining({
        sourceType: "terrain-tile",
        animationKey: "grass_0",
        frameWidth: 16,
        frameHeight: 16,
        frameCount: 1,
        caseId: 2,
        materialId: "grass",
        cellX: 4,
        cellY: 6,
        rotate90: 0,
        flipX: false,
        flipY: false,
        scale: 3,
      }),
    );
  });

  test("PREVIEW_SHOW_TILE_EVENT handler does nothing when texture does not exist", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene } = makeScene();

    (scene.textures.exists as ReturnType<typeof vi.fn>).mockReturnValue(false);

    adapter.create(scene as never);
    vi.mocked(scene.game.events.emit).mockClear();

    scene.game.events.emit(PREVIEW_SHOW_TILE_EVENT, {
      textureKey: "missing.atlas",
      frame: "tile_0",
      caseId: 0,
      materialId: "grass",
      cellX: 0,
      cellY: 0,
      rotate90: 0,
      flipX: false,
      flipY: false,
    });

    expect(scene.game.events.emit).not.toHaveBeenCalledWith(
      PREVIEW_INFO_EVENT,
      expect.anything(),
    );
  });

  test("equipment sprite becomes visible when equipKey animation exists and frameIndex is null", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene, sprites } = makeScene();

    const animationFrames = [
      { textureKey: "bloomseed.characters", textureFrame: "player_idle_0" },
    ];
    (scene.anims.get as ReturnType<typeof vi.fn>).mockReturnValue({
      frames: animationFrames,
    });
    (scene.anims.exists as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const frameObj = { width: 32, height: 48 };
    const textureObj = { get: vi.fn().mockReturnValue(frameObj) };
    (scene.textures.get as ReturnType<typeof vi.fn>).mockReturnValue(
      textureObj,
    );

    adapter.create(scene as never);

    scene.game.events.emit(PREVIEW_PLAY_EVENT, {
      key: "player:idle",
      flipX: false,
      equipKey: "equip:sword",
      equipFlipX: false,
      frameIndex: null,
    });

    expect(sprites).toHaveLength(2);
    const equipSpriteObj = sprites[1]!;
    expect(equipSpriteObj.setVisible).toHaveBeenCalledWith(true);
    expect(equipSpriteObj.play).toHaveBeenCalledWith("equip:sword", false);
  });

  test("equipment sprite is hidden when PREVIEW_PLAY_EVENT has a frameIndex", () => {
    const adapter = createPreviewSceneLifecycle();
    const { scene, sprites } = makeScene();

    const animationFrames = [
      { textureKey: "bloomseed.characters", textureFrame: "player_idle_0" },
      { textureKey: "bloomseed.characters", textureFrame: "player_idle_1" },
    ];
    (scene.anims.get as ReturnType<typeof vi.fn>).mockReturnValue({
      frames: animationFrames,
    });
    (scene.anims.exists as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const frameObj = { width: 32, height: 48 };
    const textureObj = { get: vi.fn().mockReturnValue(frameObj) };
    (scene.textures.get as ReturnType<typeof vi.fn>).mockReturnValue(
      textureObj,
    );

    adapter.create(scene as never);

    // First call without frameIndex to create equipment sprite
    scene.game.events.emit(PREVIEW_PLAY_EVENT, {
      key: "player:idle",
      flipX: false,
      equipKey: "equip:sword",
      equipFlipX: false,
      frameIndex: null,
    });

    // Clear only the spy call records on the equip sprite
    const equipSpriteObj = sprites[1]!;
    equipSpriteObj.setVisible.mockClear();

    // Second call with frameIndex should hide equipment sprite
    scene.game.events.emit(PREVIEW_PLAY_EVENT, {
      key: "player:idle",
      flipX: false,
      equipKey: "equip:sword",
      equipFlipX: false,
      frameIndex: 1,
    });

    expect(equipSpriteObj.setVisible).toHaveBeenCalledWith(false);
  });
});
