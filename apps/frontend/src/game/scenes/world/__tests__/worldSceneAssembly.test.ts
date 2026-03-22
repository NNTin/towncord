import { beforeEach, describe, expect, test, vi } from "vitest";

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
    anchorX16: 0,
    anchorY16: 0,
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
  officeShouldContinuePainting: vi.fn(() => false),
  officeSyncHighlight: vi.fn(),
  officeTryHandlePointerDown: vi.fn(() => false),
  officeUpdate: vi.fn(),
  placementHandlePlaceObjectDrop: vi.fn(),
  projectionEmit: vi.fn(),
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
  },
  terrainSystemDestroy: vi.fn(),
  terrainSystemUpdate: vi.fn(),
  townCollisionGridConstruct: vi.fn(),
}));

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

vi.mock("../../../application/gameComposition", () => ({
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY: "bloomseed.worldBootstrap",
  getBloomseedWorldBootstrap: vi.fn(() => ({
    catalog: {},
    entityRegistry: {},
  })),
}));

vi.mock("../../office/bootstrap", () => ({
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY: "officeSceneBootstrap",
  createOfficeSceneBootstrap: assemblyMocks.createOfficeSceneBootstrap,
  getOfficeSceneBootstrap: assemblyMocks.getOfficeSceneBootstrap,
}));

vi.mock("../../../terrain", () => ({
  TerrainSystem: class {
    public update = assemblyMocks.terrainSystemUpdate;
    public destroy = assemblyMocks.terrainSystemDestroy;

    public getGameplayGrid() {
      return assemblyMocks.terrainGrid;
    }
  },
}));

vi.mock("../../../town/collisionGrid", () => ({
  TownCollisionGrid: class {
    constructor(...args: unknown[]) {
      assemblyMocks.townCollisionGridConstruct(...args);
    }
  },
}));

vi.mock("../navigation", () => ({
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
    public emitPlayerStateChanged = assemblyMocks.projectionEmit;
  },
}));

vi.mock("../worldSceneCameraController", () => ({
  WorldSceneCameraController: class {
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
}));

vi.mock("../worldSceneDiagnosticsController", () => ({
  WorldSceneDiagnosticsController: class {
    public recordFrame = assemblyMocks.diagnosticsRecordFrame;
    public reset = assemblyMocks.diagnosticsReset;
  },
}));

vi.mock("../worldSceneOfficeRuntime", () => ({
  WorldSceneOfficeRuntime: class {
    public bootstrap = assemblyMocks.officeBootstrap;
    public tryHandlePointerDown = assemblyMocks.officeTryHandlePointerDown;
    public shouldContinuePainting = assemblyMocks.officeShouldContinuePainting;
    public continuePainting = assemblyMocks.officeContinuePainting;
    public syncHighlight = assemblyMocks.officeSyncHighlight;
    public endPainting = assemblyMocks.officeEndPainting;
    public update = assemblyMocks.officeUpdate;
    public handleSetEditorTool = assemblyMocks.officeHandleSetEditorTool;
    public dispose = assemblyMocks.officeDispose;
  },
}));

vi.mock("../worldScenePlacementController", () => ({
  WorldScenePlacementController: class {
    public handlePlaceObjectDrop = assemblyMocks.placementHandlePlaceObjectDrop;
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
    public continuePainting =
      assemblyMocks.terrainControllerContinuePainting;
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

vi.mock("../inputRouter", () => ({
  WorldSceneInputRouter: class {
    public onPointerDown = assemblyMocks.inputRouterOnPointerDown;
    public onPointerMove = assemblyMocks.inputRouterOnPointerMove;
    public onPointerUp = assemblyMocks.inputRouterOnPointerUp;
  },
}));

import { WorldScene } from "../../WorldScene";

describe("WorldScene assembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assemblyMocks.getOfficeSceneBootstrap.mockReturnValue({
      layout: assemblyMocks.officeSceneBootstrapLayout,
    });
  });

  test("assembles feature runtimes in create and delegates updates to them", () => {
    const scene = new WorldScene() as unknown as Record<string, unknown>;

    scene.registry = {
      get: vi.fn(() => ({ world: true })),
    };
    scene.input = {
      activePointer: {
        withinGame: true,
        x: 12,
        y: 34,
      },
      keyboard: {
        addKeys: vi.fn(() => ({
          W: { isDown: false },
          A: { isDown: false },
          S: { isDown: false },
          D: { isDown: false },
        })),
        addKey: vi.fn(() => ({ isDown: false })),
      },
      on: vi.fn(),
      off: vi.fn(),
    };
    scene.scale = {
      once: vi.fn(),
    };
    scene.events = {
      once: vi.fn(),
    };
    scene.cameras = {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    };
    scene.game = {
      events: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    (scene.create as () => void)();

    expect(assemblyMocks.getOfficeSceneBootstrap).toHaveBeenCalledWith({ world: true });
    expect(assemblyMocks.officeBootstrap).toHaveBeenCalledWith(
      assemblyMocks.officeSceneBootstrapLayout,
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

    (scene.update as (_time: number, delta: number) => void)(0, 16);

    expect(assemblyMocks.terrainSystemUpdate).toHaveBeenCalledOnce();
    expect(assemblyMocks.entitySystemUpdate).toHaveBeenCalledOnce();
    expect(assemblyMocks.diagnosticsRecordFrame).toHaveBeenCalledOnce();
    expect(assemblyMocks.officeUpdate).toHaveBeenCalledOnce();
  });

  test("tears down runtime modules and scene bindings on shutdown", () => {
    const scene = new WorldScene() as unknown as Record<string, unknown>;

    scene.registry = {
      get: vi.fn(() => ({ world: true })),
    };
    scene.input = {
      activePointer: {
        withinGame: true,
        x: 12,
        y: 34,
      },
      keyboard: {
        addKeys: vi.fn(() => ({
          W: { isDown: false },
          A: { isDown: false },
          S: { isDown: false },
          D: { isDown: false },
        })),
        addKey: vi.fn(() => ({ isDown: false })),
      },
      on: vi.fn(),
      off: vi.fn(),
    };
    scene.scale = {
      once: vi.fn(),
    };
    scene.events = {
      once: vi.fn(),
    };
    scene.cameras = {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    };
    scene.game = {
      events: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    (scene.create as () => void)();
    expect(assemblyMocks.officeBootstrap).toHaveBeenCalledWith(
      assemblyMocks.officeSceneBootstrapLayout,
    );
    (scene.handleShutdown as () => void)();

    expect(assemblyMocks.commandUnbind).toHaveBeenCalledOnce();
    expect(
      (scene.input as { off: ReturnType<typeof vi.fn> }).off,
    ).toHaveBeenCalledTimes(5);
    expect(assemblyMocks.entitySystemDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.terrainSystemDestroy).toHaveBeenCalledOnce();
    expect(assemblyMocks.officeDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.selectionDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.terrainControllerDispose).toHaveBeenCalledOnce();
    expect(assemblyMocks.cameraReset).toHaveBeenCalledOnce();
    expect(assemblyMocks.diagnosticsReset).toHaveBeenCalledOnce();
  });
});
