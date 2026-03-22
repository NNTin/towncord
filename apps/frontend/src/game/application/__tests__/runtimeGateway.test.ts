import { describe, expect, test, vi } from "vitest";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
} from "../../previewRuntimeContract";
import { RUNTIME_TO_UI_EVENTS, UI_TO_RUNTIME_COMMANDS } from "../../protocol";

const {
  createGameMock,
  phaserGameMock,
} = vi.hoisted(() => ({
  createGameMock: vi.fn(),
  phaserGameMock: vi.fn(),
}));

vi.mock("phaser", () => {
  class Scene {}

  return {
    default: {
      AUTO: "AUTO",
      Scale: {
        NONE: "NONE",
      },
      Scene,
      Game: phaserGameMock,
      Math: {
        Clamp: (value: number, min: number, max: number) =>
          Math.max(min, Math.min(max, value)),
      },
    },
  };
});

vi.mock("../../phaser/createGame", () => ({
  createGame: createGameMock,
}));

import {
  createPreviewRuntimeGateway,
  createRuntimeGateway,
  type PreviewRuntimeState,
  type RuntimeBootstrap,
} from "../runtimeGateway";

function createRuntimeHost() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    destroy: vi.fn(),
    events: {
      emit: vi.fn((event: string, payload?: unknown) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      }),
      on: vi.fn((event: string, listener: (payload: unknown) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }

        listeners.get(event)!.add(listener);
      }),
      off: vi.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.get(event)?.delete(listener);
      }),
    },
  };
}

function createBootstrapPayload(): RuntimeBootstrap {
  return {
    catalog: {
      entityTypes: [],
      playerModels: [],
      mobFamilies: [],
      propFamilies: [],
      tilesetFamilies: [],
      officeCharacterPalettes: [],
      officeCharacterIds: [],
      officeEnvironmentGroups: [],
      officeFurnitureGroups: [],
      tracksByPath: new Map(),
    },
    placeables: [
      {
        id: "terrain:grass:paint",
        type: "terrain",
        materialId: "grass",
        brushId: "paint",
        label: "Grass",
        groupKey: "terrain:ground",
        groupLabel: "Ground",
      },
    ],
  };
}

describe("RuntimeGateway", () => {
  test("owns runtime lifecycle and tears the game down through the session", () => {
    const runtimeHost = createRuntimeHost();
    const createRuntime = vi.fn(() => runtimeHost);
    const gateway = createRuntimeGateway({ createRuntime });
    const session = gateway.mount({} as HTMLElement);

    expect(createRuntime).toHaveBeenCalledTimes(1);

    session.destroy();

    expect(runtimeHost.destroy).toHaveBeenCalledWith(true);
  });

  test("replays bootstrap to late subscribers and ignores duplicate ready events", () => {
    const runtimeHost = createRuntimeHost();
    const gateway = createRuntimeGateway({
      createRuntime: () => runtimeHost,
    });
    const session = gateway.mount({} as HTMLElement);
    const bootstrap = createBootstrapPayload();
    const firstSubscriber = {
      onBootstrap: vi.fn(),
    };

    session.subscribe(firstSubscriber);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.RUNTIME_READY, bootstrap);

    const lateSubscriber = {
      onBootstrap: vi.fn(),
    };
    session.subscribe(lateSubscriber);
    runtimeHost.events.emit(RUNTIME_TO_UI_EVENTS.RUNTIME_READY, bootstrap);

    expect(firstSubscriber.onBootstrap).toHaveBeenCalledTimes(1);
    expect(firstSubscriber.onBootstrap).toHaveBeenCalledWith(bootstrap);
    expect(lateSubscriber.onBootstrap).toHaveBeenCalledTimes(1);
    expect(lateSubscriber.onBootstrap).toHaveBeenCalledWith(bootstrap);
  });

  test("sends application commands through the runtime boundary", () => {
    const runtimeHost = createRuntimeHost();
    const gateway = createRuntimeGateway({
      createRuntime: () => runtimeHost,
    });
    const session = gateway.mount({} as HTMLElement);

    session.selectTerrainTool({
      materialId: "grass",
      brushId: "paint",
    });
    session.setOfficeEditorTool({ tool: null });
    session.setZoom(1.5);
    session.placeDragDrop(
      {
        type: "terrain",
        materialId: "stone",
        brushId: "fill",
      },
      {
        screenX: 12,
        screenY: 24,
      },
    );

    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      1,
      UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
      {
        materialId: "grass",
        brushId: "paint",
      },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      2,
      UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL,
      { tool: null },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      3,
      UI_TO_RUNTIME_COMMANDS.SET_ZOOM,
      { zoom: 1.5 },
    );
    expect(runtimeHost.events.emit).toHaveBeenNthCalledWith(
      4,
      UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP,
      {
        type: "terrain",
        materialId: "stone",
        brushId: "fill",
        screenX: 12,
        screenY: 24,
      },
    );
  });
});

describe("PreviewRuntimeGateway", () => {
  test("owns preview runtime lifecycle behind the gateway", () => {
    const runtimeHost = createRuntimeHost();
    phaserGameMock.mockImplementation(() => runtimeHost);
    const gateway = createPreviewRuntimeGateway();
    const session = gateway.mount({} as HTMLElement);

    session.destroy();

    expect(phaserGameMock).toHaveBeenCalledTimes(1);
    expect(runtimeHost.destroy).toHaveBeenCalledWith(true);
  });

  test("queues preview commands until the preview runtime reports ready", () => {
    const runtimeHost = createRuntimeHost();
    phaserGameMock.mockImplementation(() => runtimeHost);
    const gateway = createPreviewRuntimeGateway();
    const session = gateway.mount({} as HTMLElement);

    session.showTile({
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
    expect(runtimeHost.events.emit).not.toHaveBeenCalledWith(
      PREVIEW_SHOW_TILE_EVENT,
      expect.anything(),
    );

    runtimeHost.events.emit(PREVIEW_READY_EVENT);

    expect(runtimeHost.events.emit).toHaveBeenLastCalledWith(
      PREVIEW_SHOW_TILE_EVENT,
      {
        textureKey: "debug.tilesets",
        frame: "grass_0",
        caseId: 2,
        materialId: "grass",
        cellX: 4,
        cellY: 6,
        rotate90: 0,
        flipX: false,
        flipY: false,
      },
    );
  });

  test("forwards preview info notifications to subscribers", () => {
    const runtimeHost = createRuntimeHost();
    phaserGameMock.mockImplementation(() => runtimeHost);
    const gateway = createPreviewRuntimeGateway();
    const session = gateway.mount({} as HTMLElement);
    const onInfo = vi.fn();
    const payload: PreviewRuntimeState = {
      sourceType: "animation",
      animationKey: "characters.bloomseed.player.idle.down",
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 6,
      flipX: false,
      flipY: false,
      scale: 3,
      displayWidth: 192,
      displayHeight: 192,
    };

    session.subscribe({ onInfo });
    runtimeHost.events.emit(PREVIEW_INFO_EVENT, payload);

    expect(onInfo).toHaveBeenCalledWith(payload);

    runtimeHost.events.emit(PREVIEW_READY_EVENT);
    session.showAnimation({
      key: payload.animationKey,
      flipX: false,
      equipKey: null,
      equipFlipX: false,
      frameIndex: null,
    });

    expect(runtimeHost.events.emit).toHaveBeenLastCalledWith(
      PREVIEW_PLAY_EVENT,
      {
        key: payload.animationKey,
        flipX: false,
        equipKey: null,
        equipFlipX: false,
        frameIndex: null,
      },
    );
  });
});
