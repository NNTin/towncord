import { beforeEach, describe, expect, test, vi } from "vitest";
import type { OfficeSceneBootstrap } from "../../../contracts/office-scene";

const assemblyMocks = vi.hoisted(() => ({
  cameraBeginPan: vi.fn(),
  cameraCenterCameraOnWorld: vi.fn(),
  cameraEndPan: vi.fn(),
  cameraHandleSetZoom: vi.fn(),
  cameraHandleWheel: vi.fn(),
  cameraInitialize: vi.fn(),
  cameraIsPanActive: vi.fn(() => false),
  cameraReset: vi.fn(),
  cameraUpdatePan: vi.fn(),
  commandBind: vi.fn(),
  commandUnbind: vi.fn(),
  createTerrainNavigationService: vi.fn(() => ({ id: "nav" })),
  diagnosticsRecordFrame: vi.fn(),
  diagnosticsReset: vi.fn(),
  entitySystemConstruct: vi.fn(),
  entitySystemDispose: vi.fn(),
  entitySystemUpdate: vi.fn(),
  inputRouterOnPointerDown: vi.fn(),
  inputRouterOnPointerMove: vi.fn(),
  inputRouterOnPointerUp: vi.fn(),
  officeBootstrap: vi.fn(() => ({
    anchor: {
      x: 0,
      y: 0,
    },
    layout: {
      cols: 1,
      rows: 1,
      cellSize: 16,
      tiles: [],
      furniture: [],
      characters: [],
    },
  })),
  officeSceneBootstrapLayout: {
    cols: 2,
    rows: 2,
    cellSize: 16,
    tiles: [],
    furniture: [],
    characters: [],
  },
  createOfficeSceneBootstrap: vi.fn(() => ({
    anchor: {
      x: 2,
      y: 3,
    },
    layout: {
      cols: 3,
      rows: 3,
      cellSize: 16,
      tiles: [],
      furniture: [],
      characters: [],
    },
  })),
  getOfficeSceneBootstrap: vi.fn(() => ({
    anchor: {
      x: 2,
      y: 3,
    },
    layout: {
      cols: 2,
      rows: 2,
      cellSize: 16,
      tiles: [],
      furniture: [],
      characters: [],
    },
  })),
  officeContinuePainting: vi.fn(),
  officeDispose: vi.fn(),
  officeEndPainting: vi.fn(),
  officeHandleSetEditorTool: vi.fn(),
  officeRotateSelectedFurniture: vi.fn(),
  officeTryHandleSecondaryPointerDown: vi.fn(() => false),
  officeShouldContinuePainting: vi.fn(() => false),
  officeSyncHighlight: vi.fn(),
  officeTryHandlePointerDown: vi.fn(() => false),
  officeUpdate: vi.fn(),
  placementHandlePlaceEntityDrop: vi.fn(),
  projectionEmit: vi.fn(),
  projectionEmitRuntimeReady: vi.fn(),
  projectionEmitTerrainSeedChanged: vi.fn(),
  selectionCreateSelectionBadge: vi.fn(),
  selectionDispose: vi.fn(),
  selectionHandleSelectionAndInspect: vi.fn(),
  selectionSelectEntity: vi.fn(),
  selectionSyncSelectionBadgePosition: vi.fn(),
  terrainControllerBeginPainting: vi.fn(),
  terrainControllerContinuePainting: vi.fn(),
  terrainControllerCreateBrushPreview: vi.fn(),
  terrainControllerDispose: vi.fn(),
  terrainControllerEndPainting: vi.fn(),
  terrainControllerHandlePlaceTerrainDrop: vi.fn(),
  terrainControllerHandleSelectTerrainTool: vi.fn(),
  terrainControllerHasActiveTool: vi.fn(() => false),
  terrainControllerShouldContinuePainting: vi.fn(() => false),
  terrainControllerSyncPreviewFromPointer: vi.fn(),
  terrainGrid: {
    getWorldBounds: vi.fn(() => ({ width: 100, height: 80 })),
    getRevision: vi.fn(() => 1),
    worldToCell: vi.fn(() => ({ cellX: 0, cellY: 0 })),
    isCellWalkable: vi.fn(() => true),
    cellToWorldCenter: vi.fn(() => ({ worldX: 0, worldY: 0 })),
    findPath: vi.fn(() => ({ cells: [], revision: 1 })),
    clampWorldPoint: vi.fn((worldX: number, worldY: number) => ({
      worldX,
      worldY,
    })),
    isWorldWalkable: vi.fn(() => true),
  },
  terrainRuntimeDestroy: vi.fn(),
  terrainRuntimeUpdate: vi.fn(),
  unifiedCollisionMapConstruct: vi.fn(),
}));

function createEventBus() {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    emit: vi.fn((event: string, payload: unknown) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    }),
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
  };
}

vi.mock("phaser", () => {
  class Scene {
    constructor(_key?: string) {}
  }

  return {
    default: {
      Scene,
      Input: {
        Keyboard: {
          KeyCodes: {
            SHIFT: 16,
            R: 82,
          },
        },
      },
      Scale: {
        Events: {
          RESIZE: "resize",
        },
      },
    },
  };
});

vi.mock(
  "../../../application/runtime-compilation/load-plans/runtimeBootstrap",
  () => ({
    WORLD_BOOTSTRAP_REGISTRY_KEY: "worldBootstrap",
    getWorldBootstrap: vi.fn(() => ({
      catalog: {},
      entityRegistry: {},
    })),
  }),
);

vi.mock("../../../runtime/transport/runtimeEvents", () => ({
  RUNTIME_TO_UI_EVENTS: {
    RUNTIME_READY: "runtimeReady",
  },
  emitRuntimeToUiEvent: vi.fn(),
  normalizeRuntimeBootstrapPayload: vi.fn((value: unknown) => value),
}));

vi.mock(
  "../../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap",
  () => ({
    OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY: "officeSceneBootstrap",
    createOfficeSceneBootstrap: assemblyMocks.createOfficeSceneBootstrap,
    getOfficeSceneBootstrap: assemblyMocks.getOfficeSceneBootstrap,
  }),
);

vi.mock("../../../terrain/runtime", () => ({
  createTerrainRuntimeContext: vi.fn(() => ({
    seedDocument: {
      width: 1,
      height: 1,
      chunkSize: 1,
      defaultMaterial: "ground",
      materials: ["ground"],
      legend: {
        ".": "ground",
      },
      rows: ["."],
    },
    runtimeOptions: {
      gridSpec: {
        width: 1,
        height: 1,
        chunkSize: 1,
        defaultMaterial: "ground",
        materials: ["ground"],
        cells: ["ground"],
      },
      store: {
        hasDirtyChunks: vi.fn(() => false),
        consumeDirtyChunks: vi.fn(() => []),
        getCellMaterial: vi.fn(() => "ground"),
      },
      chunkBuilder: {
        buildChunkPayload: vi.fn(),
      },
      commands: {
        queueDrop: vi.fn(),
        flushPendingDrops: vi.fn(() => []),
        clearPendingDrops: vi.fn(),
      },
      queries: {
        getGameplayGrid: vi.fn(() => assemblyMocks.terrainGrid),
        previewPaintAtWorld: vi.fn(() => []),
        inspectAtWorld: vi.fn(() => null),
      },
      visibleChunks: {
        resolveVisibleChunkIds: vi.fn(() => []),
      },
    },
  })),
}));

vi.mock("../../../content/document-export", () => ({
  syncFromRuntimeTerrain: vi.fn((seed) => ({
    ...seed,
    rows: ["."],
  })),
}));

vi.mock("../../../../engine", () => ({
  TerrainRuntime: class {
    public update = assemblyMocks.terrainRuntimeUpdate;
    public destroy = assemblyMocks.terrainRuntimeDestroy;

    constructor(..._args: unknown[]) {}

    public getGameplayGrid() {
      return assemblyMocks.terrainGrid;
    }
  },
  UnifiedCollisionMap: class {
    constructor(...args: unknown[]) {
      assemblyMocks.unifiedCollisionMapConstruct(...args);
    }
  },
  doesFurnitureBlockMovement: (furniture: {
    placement: string;
    category: string;
  }) => furniture.placement === "floor" && furniture.category !== "chairs",
  WorldRuntimeCameraController: class {
    public initialize = assemblyMocks.cameraInitialize;
    public centerCameraOnWorld = assemblyMocks.cameraCenterCameraOnWorld;
    public beginPan = assemblyMocks.cameraBeginPan;
    public updatePan = assemblyMocks.cameraUpdatePan;
    public endPan = assemblyMocks.cameraEndPan;
    public isPanActive = assemblyMocks.cameraIsPanActive;
    public handleWheel = assemblyMocks.cameraHandleWheel;
    public handleSetZoom = assemblyMocks.cameraHandleSetZoom;
    public reset = assemblyMocks.cameraReset;
  },
  WorldRuntimeDiagnosticsController: class {
    public recordFrame = assemblyMocks.diagnosticsRecordFrame;
    public reset = assemblyMocks.diagnosticsReset;
  },
  WorldRuntimeInputRouter: class {
    public onPointerDown = assemblyMocks.inputRouterOnPointerDown;
    public onPointerMove = assemblyMocks.inputRouterOnPointerMove;
    public onPointerUp = assemblyMocks.inputRouterOnPointerUp;
  },
  createTerrainNavigationService: assemblyMocks.createTerrainNavigationService,
}));

vi.mock("../entitySystem", () => ({
  EntitySystem: class {
    public static spriteOriginY = 0.75;

    constructor(...args: unknown[]) {
      assemblyMocks.entitySystemConstruct(...args);
    }

    public update = assemblyMocks.entitySystemUpdate;
    public dispose = assemblyMocks.entitySystemDispose;

    public getAll() {
      return [];
    }
  },
}));

vi.mock("../worldSceneProjections", () => ({
  WorldSceneProjectionEmitter: class {
    public emitRuntimeReady = assemblyMocks.projectionEmitRuntimeReady;
    public emitPlayerStateChanged = assemblyMocks.projectionEmit;
    public emitTerrainSeedChanged =
      assemblyMocks.projectionEmitTerrainSeedChanged;
  },
}));

vi.mock("../worldSceneOfficeRuntime", () => ({
  WorldSceneOfficeRuntime: class {
    public bootstrap = assemblyMocks.officeBootstrap;
    public tryHandlePointerDown = assemblyMocks.officeTryHandlePointerDown;
    public tryHandleSecondaryPointerDown =
      assemblyMocks.officeTryHandleSecondaryPointerDown;
    public shouldContinuePainting = assemblyMocks.officeShouldContinuePainting;
    public continuePainting = assemblyMocks.officeContinuePainting;
    public syncHighlight = assemblyMocks.officeSyncHighlight;
    public endPainting = assemblyMocks.officeEndPainting;
    public rotateSelectedFurniture =
      assemblyMocks.officeRotateSelectedFurniture;
    public update = assemblyMocks.officeUpdate;
    public handleSetEditorTool = assemblyMocks.officeHandleSetEditorTool;
    public dispose = assemblyMocks.officeDispose;
  },
}));

vi.mock("../worldScenePlacementController", () => ({
  WorldScenePlacementController: class {
    public handlePlaceEntityDrop = assemblyMocks.placementHandlePlaceEntityDrop;
  },
}));

vi.mock("../worldSceneSelectionController", () => ({
  WorldSceneSelectionController: class {
    public createSelectionBadge = assemblyMocks.selectionCreateSelectionBadge;
    public handleSelectionAndInspect =
      assemblyMocks.selectionHandleSelectionAndInspect;
    public selectEntity = assemblyMocks.selectionSelectEntity;
    public syncSelectionBadgePosition =
      assemblyMocks.selectionSyncSelectionBadgePosition;
    public dispose = assemblyMocks.selectionDispose;
  },
}));

vi.mock("../worldSceneTerrainController", () => ({
  WorldSceneTerrainController: class {
    public createBrushPreview =
      assemblyMocks.terrainControllerCreateBrushPreview;
    public hasActiveTool = assemblyMocks.terrainControllerHasActiveTool;
    public beginPainting = assemblyMocks.terrainControllerBeginPainting;
    public shouldContinuePainting =
      assemblyMocks.terrainControllerShouldContinuePainting;
    public continuePainting = assemblyMocks.terrainControllerContinuePainting;
    public endPainting = assemblyMocks.terrainControllerEndPainting;
    public handlePlaceTerrainDrop =
      assemblyMocks.terrainControllerHandlePlaceTerrainDrop;
    public handleSelectTerrainTool =
      assemblyMocks.terrainControllerHandleSelectTerrainTool;
    public syncPreviewFromPointer =
      assemblyMocks.terrainControllerSyncPreviewFromPointer;
    public dispose = assemblyMocks.terrainControllerDispose;
  },
}));

vi.mock("../worldSceneCommandBindings", () => ({
  WorldSceneCommandBindings: class {
    public bind = assemblyMocks.commandBind;
    public unbind = assemblyMocks.commandUnbind;
  },
}));

import { createWorldSceneLifecycle } from "../../../../game/runtime/world/createWorldSceneLifecycle";

function makeScene(): Record<string, unknown> {
  const gameEvents = createEventBus();
  const movementKeys = {
    W: { isDown: false },
    A: { isDown: false },
    S: { isDown: false },
    D: { isDown: false },
  };
  const shiftKey = { isDown: false };
  const rKey = { isDown: false };

  return {
    registry: {
      get: vi.fn(() => ({ world: true })),
    },
    input: {
      activePointer: { withinGame: true, x: 12, y: 34 },
      keyboard: {
        addKeys: vi.fn(() => movementKeys),
        addKey: vi.fn((keyCode: number) => (keyCode === 16 ? shiftKey : rKey)),
      },
      on: vi.fn(),
      off: vi.fn(),
    },
    scale: { once: vi.fn() },
    events: { once: vi.fn() },
    cameras: {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    },
    game: {
      events: gameEvents,
    },
    __testKeys: {
      movementKeys,
      shiftKey,
      rKey,
    },
  };
}

describe("WorldScene assembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assemblyMocks.getOfficeSceneBootstrap.mockReturnValue({
      anchor: {
        x: 2,
        y: 3,
      },
      layout: assemblyMocks.officeSceneBootstrapLayout,
    });
  });

  test("assembles feature runtimes in boot and delegates updates to them", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();

    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    expect(assemblyMocks.getOfficeSceneBootstrap).toHaveBeenCalledWith({
      world: true,
    });
    expect(assemblyMocks.officeBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: {
          x: 2,
          y: 3,
        },
        layout: assemblyMocks.officeSceneBootstrapLayout,
      }),
    );
    expect(assemblyMocks.createOfficeSceneBootstrap).not.toHaveBeenCalled();
    expect(assemblyMocks.createTerrainNavigationService).toHaveBeenCalledOnce();
    expect(assemblyMocks.entitySystemConstruct).toHaveBeenCalledOnce();
    expect(assemblyMocks.selectionCreateSelectionBadge).toHaveBeenCalledOnce();
    expect(
      assemblyMocks.terrainControllerCreateBrushPreview,
    ).toHaveBeenCalledOnce();
    expect(assemblyMocks.commandBind).toHaveBeenCalledOnce();
    expect(assemblyMocks.cameraInitialize).toHaveBeenCalledOnce();
    expect(assemblyMocks.projectionEmitRuntimeReady).not.toHaveBeenCalled();

    lifecycle.update(16);

    expect(assemblyMocks.terrainRuntimeUpdate).toHaveBeenCalledOnce();
    expect(assemblyMocks.entitySystemUpdate).toHaveBeenCalledOnce();
    expect(assemblyMocks.diagnosticsRecordFrame).toHaveBeenCalledOnce();
    expect(assemblyMocks.officeUpdate).toHaveBeenCalledOnce();
  });

  test("tears down runtime modules and protocol bindings on dispose", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();

    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);
    expect(assemblyMocks.officeBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: {
          x: 2,
          y: 3,
        },
        layout: assemblyMocks.officeSceneBootstrapLayout,
      }),
    );
    lifecycle.dispose();

    expect(assemblyMocks.commandUnbind).toHaveBeenCalledOnce();
    expect(assemblyMocks.entitySystemDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.terrainRuntimeDestroy).toHaveBeenCalledOnce();
    expect(assemblyMocks.officeDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.selectionDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.terrainControllerDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.cameraReset).toHaveBeenCalledOnce();
    expect(assemblyMocks.diagnosticsReset).toHaveBeenCalledOnce();
  });

  test("uses createOfficeSceneBootstrap fallback when registry returns nothing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assemblyMocks.getOfficeSceneBootstrap.mockReturnValue(null as any);
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();

    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    expect(assemblyMocks.createOfficeSceneBootstrap).toHaveBeenCalledOnce();
  });

  test("delegates pointer events to inputRouter", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();
    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    const pointer = { x: 5, y: 10 } as unknown as Parameters<
      typeof lifecycle.onPointerDown
    >[0];
    lifecycle.onPointerDown(pointer);
    lifecycle.onPointerMove(pointer);
    lifecycle.onPointerUp(pointer);

    expect(assemblyMocks.inputRouterOnPointerDown).toHaveBeenCalledWith(
      pointer,
    );
    expect(assemblyMocks.inputRouterOnPointerMove).toHaveBeenCalledWith(
      pointer,
    );
    expect(assemblyMocks.inputRouterOnPointerUp).toHaveBeenCalledWith(pointer);
  });

  test("delegates wheel to cameraController and terrainController", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();
    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    const activePointer = { x: 1, y: 2 } as unknown as Parameters<
      typeof lifecycle.onWheel
    >[1];
    lifecycle.onWheel(50, activePointer);

    expect(assemblyMocks.cameraHandleWheel).toHaveBeenCalledWith(50);
    expect(
      assemblyMocks.terrainControllerSyncPreviewFromPointer,
    ).toHaveBeenCalledWith(activePointer);
  });

  test("delegates resize to cameraController.centerCameraOnWorld", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene();
    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    lifecycle.onResize();

    expect(assemblyMocks.cameraCenterCameraOnWorld).toHaveBeenCalledOnce();
  });

  test("rebuilds the office furniture blocking lookup when the layout changes", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene() as ReturnType<typeof makeScene> & {
      game: {
        events: {
          emit: (event: string, payload: unknown) => void;
        };
      };
    };
    const layout: OfficeSceneBootstrap["layout"] = {
      cols: 2,
      rows: 1,
      cellSize: 16,
      tiles: [
        { kind: "floor" as const, tileId: 0 },
        { kind: "floor" as const, tileId: 0 },
      ],
      furniture: [] as Array<{
        id: string;
        assetId: string;
        label: string;
        category:
          | "chairs"
          | "decor"
          | "desks"
          | "electronics"
          | "misc"
          | "storage"
          | "wall";
        placement: "floor" | "surface" | "wall";
        col: number;
        row: number;
        width: number;
        height: number;
        color: number;
        accentColor: number;
      }>,
      characters: [],
    };

    assemblyMocks.officeBootstrap.mockReturnValueOnce({
      anchor: {
        x: 0,
        y: 0,
      },
      layout,
    } as never);

    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    const collisionLookup = assemblyMocks.unifiedCollisionMapConstruct.mock
      .calls[0]?.[1] as
      | {
          isFurnitureBlockingCell?: (col: number, row: number) => boolean;
        }
      | undefined;
    expect(collisionLookup?.isFurnitureBlockingCell?.(0, 0)).toBe(false);

    layout.furniture.push({
      id: "desk",
      assetId: "desk-1",
      label: "Desk",
      category: "desks",
      placement: "floor",
      col: 0,
      row: 0,
      width: 1,
      height: 1,
      color: 0x111111,
      accentColor: 0x222222,
    });
    scene.game.events.emit("officeLayoutChanged", { layout });

    expect(collisionLookup?.isFurnitureBlockingCell?.(0, 0)).toBe(true);
  });

  test("rotates selected furniture on the R key rising edge", () => {
    const lifecycle = createWorldSceneLifecycle();
    const scene = makeScene() as ReturnType<typeof makeScene> & {
      __testKeys: {
        movementKeys: {
          W: { isDown: boolean };
          A: { isDown: boolean };
          S: { isDown: boolean };
          D: { isDown: boolean };
        };
        shiftKey: { isDown: boolean };
        rKey: { isDown: boolean };
      };
    };

    lifecycle.boot(scene as unknown as Parameters<typeof lifecycle.boot>[0]);

    scene.__testKeys.rKey.isDown = true;
    lifecycle.update(16);
    lifecycle.update(16);
    expect(assemblyMocks.officeRotateSelectedFurniture).toHaveBeenCalledTimes(
      1,
    );

    scene.__testKeys.rKey.isDown = false;
    lifecycle.update(16);
    scene.__testKeys.rKey.isDown = true;
    lifecycle.update(16);
    expect(assemblyMocks.officeRotateSelectedFurniture).toHaveBeenCalledTimes(
      2,
    );
  });
});
