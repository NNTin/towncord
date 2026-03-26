import { beforeEach, describe, expect, test, vi } from "vitest";
import { createGameSessionFactory } from "../GameSessionFactory";
import { createPreviewSessionFactory } from "../PreviewSessionFactory";
import type { GameSession } from "../GameSession";
import type { PreviewSession } from "../PreviewSession";

const factoryMocks = vi.hoisted(() => ({
  createWorldRuntimeHostAssembly: vi.fn(),
  createMountedGameSession: vi.fn(),
  createPreviewRuntimeHostAssembly: vi.fn(),
  createMountedPreviewSession: vi.fn(),
}));

vi.mock("../../runtime/assembly/createWorldRuntimeHostAssembly", () => ({
  createWorldRuntimeHostAssembly: factoryMocks.createWorldRuntimeHostAssembly,
}));

vi.mock("../runtime/createMountedGameSession", () => ({
  createMountedGameSession: factoryMocks.createMountedGameSession,
}));

vi.mock("../../runtime/assembly/createPreviewRuntimeHostAssembly", () => ({
  createPreviewRuntimeHostAssembly: factoryMocks.createPreviewRuntimeHostAssembly,
}));

vi.mock("../preview/createMountedPreviewSession", () => ({
  createMountedPreviewSession: factoryMocks.createMountedPreviewSession,
}));

describe("game session factories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GameSessionFactory mounts through the runtime assembly seam and session owner", () => {
    const runtimeHost = { kind: "world-runtime" };
    const session = {
      subscribe: vi.fn(),
      placeDragDrop: vi.fn(),
      selectTerrainTool: vi.fn(),
      setZoom: vi.fn(),
      setOfficeEditorTool: vi.fn(),
      destroy: vi.fn(),
    } satisfies GameSession;

    factoryMocks.createWorldRuntimeHostAssembly.mockReturnValue(runtimeHost);
    factoryMocks.createMountedGameSession.mockReturnValue(session);

    const factory = createGameSessionFactory();
    const mountedSession = factory.mount({} as HTMLElement);

    expect(mountedSession).toBe(session);
    expect(factoryMocks.createWorldRuntimeHostAssembly).toHaveBeenCalledTimes(1);
    expect(factoryMocks.createMountedGameSession).toHaveBeenCalledWith(runtimeHost);
  });

  test("PreviewSessionFactory mounts through the runtime assembly seam and preview owner", () => {
    const runtimeHost = { kind: "preview-runtime" };
    const session = {
      subscribe: vi.fn(),
      showAnimation: vi.fn(),
      showTile: vi.fn(),
      destroy: vi.fn(),
    } satisfies PreviewSession;

    factoryMocks.createPreviewRuntimeHostAssembly.mockReturnValue(runtimeHost);
    factoryMocks.createMountedPreviewSession.mockReturnValue(session);

    const factory = createPreviewSessionFactory();
    const mountedSession = factory.mount({} as HTMLElement);

    expect(mountedSession).toBe(session);
    expect(factoryMocks.createPreviewRuntimeHostAssembly).toHaveBeenCalledTimes(1);
    expect(factoryMocks.createMountedPreviewSession).toHaveBeenCalledWith(runtimeHost);
  });
});
