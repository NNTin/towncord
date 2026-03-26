import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {
    public events = {
      once: vi.fn(),
    };
    public preload(): void {}
    public create(): void {}
  }

  return {
    default: {
      Scene,
    },
  };
});

import Phaser from "phaser";
import { createPreviewRuntimeScene } from "../createPreviewRuntimeScene";
import { PREVIEW_SCENE_KEY } from "../previewSceneKeys";
import type { PreviewSceneLifecycleAdapter } from "../contracts";

function makeAdapter(): PreviewSceneLifecycleAdapter {
  return {
    preload: vi.fn(),
    create: vi.fn(),
    dispose: vi.fn(),
  };
}

function makeSceneInstance(SceneClass: typeof Phaser.Scene): Phaser.Scene {
  return new SceneClass() as unknown as Phaser.Scene;
}

describe("createPreviewRuntimeScene", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns a Phaser.Scene subclass", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    expect(SceneClass.prototype).toBeInstanceOf(Phaser.Scene);
  });

  test("uses the preview scene key", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = new SceneClass();
    expect((instance as { key?: string }).key ?? PREVIEW_SCENE_KEY).toBe(PREVIEW_SCENE_KEY);
  });

  test("preload() delegates to the injected adapter", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = makeSceneInstance(SceneClass);

    (instance as unknown as { preload(): void }).preload();

    expect(adapter.preload).toHaveBeenCalledTimes(1);
    expect(adapter.preload).toHaveBeenCalledWith(instance);
  });

  test("create() delegates to the injected adapter", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = makeSceneInstance(SceneClass);

    (instance as unknown as { create(): void }).create();

    expect(adapter.create).toHaveBeenCalledTimes(1);
    expect(adapter.create).toHaveBeenCalledWith(instance);
  });

  test("create() registers shutdown handler that calls adapter.dispose()", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = makeSceneInstance(SceneClass);

    let shutdownCallback: (() => void) | undefined;
    (instance.events.once as ReturnType<typeof vi.fn>).mockImplementation(
      (event: string, cb: () => void) => {
        if (event === "shutdown") {
          shutdownCallback = cb;
        }
      },
    );

    (instance as unknown as { create(): void }).create();

    expect(instance.events.once).toHaveBeenCalledWith("shutdown", expect.any(Function));
    expect(adapter.dispose).not.toHaveBeenCalled();

    shutdownCallback!();

    expect(adapter.dispose).toHaveBeenCalledTimes(1);
  });

  test("adapter.preload is not called during create()", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = makeSceneInstance(SceneClass);

    (instance as unknown as { create(): void }).create();

    expect(adapter.preload).not.toHaveBeenCalled();
  });

  test("adapter.create is not called during preload()", () => {
    const adapter = makeAdapter();
    const SceneClass = createPreviewRuntimeScene(adapter);
    const instance = makeSceneInstance(SceneClass);

    (instance as unknown as { preload(): void }).preload();

    expect(adapter.create).not.toHaveBeenCalled();
  });
});
