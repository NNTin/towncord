import { describe, expect, test, vi } from "vitest";
import { resolvePropPaletteItem } from "../../../content/structures/propPalette";
import { WorldSceneTerrainPropController } from "../worldSceneTerrainPropController";

vi.mock("../../../../engine", () => ({
  TERRAIN_CELL_WORLD_SIZE: 16,
}));

vi.mock("../../../../engine/world-runtime/regions", () => ({
  worldToAnchoredGridCell: (
    worldX: number,
    worldY: number,
    officeRegion: unknown,
  ) => {
    if (!officeRegion) {
      return null;
    }

    return {
      col: Math.floor(worldX / 16),
      row: Math.floor(worldY / 16),
    };
  },
}));

const farmrpgProp = resolvePropPaletteItem("prop.static.set-01.variant-01");

function createEntity(overrides: Record<string, any> = {}) {
  const terrainPropPlacement = overrides.terrainPropPlacement;
  return {
    id: overrides.id ?? "entity-1",
    definition: overrides.definition ?? {
      kind: "prop" as const,
      id: farmrpgProp?.id ?? "prop.static.set-01.variant-01",
    },
    position: overrides.position ?? { x: 32, y: 32 },
    rotationQuarterTurns: overrides.rotationQuarterTurns ?? 0,
    ...(terrainPropPlacement
      ? { terrainPropPlacement }
      : {
          terrainPropPlacement: {
            anchorCell: { cellX: 2, cellY: 2 },
            footprintW: 1,
            footprintH: 1,
            rotationQuarterTurns: 0,
          },
        }),
    sprite: {
      setRotation: vi.fn(),
      destroy: vi.fn(),
      setPosition: vi.fn(),
      setDepth: vi.fn(),
      setScale: vi.fn(),
      setFlipX: vi.fn(),
      setInteractive: vi.fn(),
      play: vi.fn(),
      displayHeight: 16,
    },
  };
}

function createHarness(options?: {
  officeRegion?: any;
  selectedEntity?: any;
  occupiedProps?: any[];
}) {
  if (!farmrpgProp) {
    throw new Error("Missing FarmRPG prop test asset");
  }

  const placedEntities: any[] = [];
  const removedEntities: any[] = [];
  let selectedEntity = options?.selectedEntity ?? null;
  const occupiedProps = options?.occupiedProps ?? [];
  const selectEntity = vi.fn((entity: unknown) => {
    selectedEntity = entity;
  });
  const addEntity = vi.fn(
    (
      _runtime: unknown,
      worldX: number,
      worldY: number,
      placement?: {
        rotationQuarterTurns?: 0 | 1 | 2 | 3;
        terrainPropPlacement?: {
          anchorCell: { cellX: number; cellY: number };
          footprintW: number;
          footprintH: number;
          rotationQuarterTurns: 0 | 1 | 2 | 3;
        };
      },
    ) => {
      const entity = createEntity({
        id: `entity-${placedEntities.length + 1}`,
        position: { x: worldX, y: worldY },
        rotationQuarterTurns: placement?.rotationQuarterTurns ?? 0,
        ...(placement?.terrainPropPlacement
          ? { terrainPropPlacement: placement.terrainPropPlacement }
          : {}),
      });
      placedEntities.push(entity);
      selectedEntity = entity;
      return entity;
    },
  );
  const removeEntity = vi.fn((entity: any) => {
    removedEntities.push(entity);
    const index = occupiedProps.indexOf(entity);
    if (index >= 0) {
      occupiedProps.splice(index, 1);
    }
    if (selectedEntity === entity) {
      selectedEntity = null;
    }
    return true;
  });
  const scene = {
    add: {
      image: vi.fn(() => ({
        destroy: vi.fn(),
        setVisible: vi.fn(),
        setTexture: vi.fn(),
        setOrigin: vi.fn(),
        setDepth: vi.fn(),
        setAlpha: vi.fn(),
        setDisplaySize: vi.fn(),
        setRotation: vi.fn(),
        setPosition: vi.fn(),
      })),
      rectangle: vi.fn(() => ({
        destroy: vi.fn(),
        setVisible: vi.fn(),
        setOrigin: vi.fn(),
        setPosition: vi.fn(),
        setDepth: vi.fn(),
        setFillStyle: vi.fn(),
        setStrokeStyle: vi.fn(),
        setSize: vi.fn(),
      })),
      text: vi.fn(() => ({
        destroy: vi.fn(),
        setVisible: vi.fn(),
        setDepth: vi.fn(),
        setText: vi.fn(),
        setPosition: vi.fn(),
      })),
    },
    cameras: {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    },
    input: {
      activePointer: null,
    },
  };

  const controller = new WorldSceneTerrainPropController({
    scene: scene as never,
    getTerrainRuntime: () =>
      ({
        getGameplayGrid: () => ({
          worldToCell: (worldX: number, worldY: number) => ({
            cellX: Math.floor(worldX / 16),
            cellY: Math.floor(worldY / 16),
          }),
          cellToWorldCenter: (cellX: number, cellY: number) => ({
            worldX: cellX * 16 + 8,
            worldY: cellY * 16 + 8,
          }),
        }),
      }) as never,
    getOfficeRegion: () => (options?.officeRegion ?? null) as never,
    getEntityRegistry: () =>
      ({
        getRuntimeById: () => ({
          definition: {
            id: farmrpgProp.id,
            kind: "prop",
            placeable: true,
          },
          createBehavior: () => ({}),
        }),
      }) as never,
    getEntitySystem: () =>
      ({
        addEntity,
        getAll: () => [...occupiedProps, ...placedEntities],
        getSelected: () => selectedEntity,
        removeEntity,
        select: (entity: unknown) => {
          selectedEntity = entity;
        },
      }) as never,
    selectEntity: selectEntity as never,
    getWorldPoint: (screenX, screenY) => ({ x: screenX, y: screenY }),
  });

  controller.setTerrainPropTool({
    tool: "prop",
    propId: farmrpgProp.id,
    rotationQuarterTurns: 0,
  });

  return {
    controller,
    addEntity,
    occupiedProps,
    removedEntities,
    scene,
    selectEntity,
    setSelectedEntity(entity: ReturnType<typeof createEntity> | null) {
      selectedEntity = entity;
    },
  };
}

describe("WorldSceneTerrainPropController", () => {
  test("places a terrain prop on a terrain cell", () => {
    const { controller, addEntity, selectEntity } = createHarness();

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        withinGame: true,
        x: 32,
        y: 32,
      } as never),
    ).toBe(true);

    expect(addEntity).toHaveBeenCalledOnce();
    expect(selectEntity).toHaveBeenCalledTimes(1);
    expect(selectEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        terrainPropPlacement: expect.objectContaining({
          anchorCell: { cellX: 2, cellY: 2 },
        }),
      }),
    );
  });

  test("ignores clicks inside the office region", () => {
    const { controller, addEntity } = createHarness({
      officeRegion: { office: true },
    });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        withinGame: true,
        x: 32,
        y: 32,
      } as never),
    ).toBe(true);

    expect(addEntity).not.toHaveBeenCalled();
  });

  test("replaces overlapping props on placement", () => {
    const occupiedProp = createEntity({
      id: "occupied-prop",
      position: { x: 32, y: 32 },
      terrainPropPlacement: {
        anchorCell: { cellX: 2, cellY: 2 },
        footprintW: 1,
        footprintH: 1,
        rotationQuarterTurns: 0,
      },
    });
    const { controller, addEntity, removedEntities } = createHarness({
      occupiedProps: [occupiedProp],
    });

    expect(
      controller.tryHandlePointerDown({
        button: 0,
        isDown: true,
        withinGame: true,
        x: 32,
        y: 32,
      } as never),
    ).toBe(true);

    expect(removedEntities).toContain(occupiedProp);
    expect(addEntity).toHaveBeenCalledOnce();
  });

  test("rotates the selected terrain prop in place", () => {
    const selectedProp = createEntity({
      id: "selected-prop",
      rotationQuarterTurns: 0,
      terrainPropPlacement: {
        anchorCell: { cellX: 2, cellY: 2 },
        footprintW: 1,
        footprintH: 2,
        rotationQuarterTurns: 0,
      },
    });
    const { controller } = createHarness({
      selectedEntity: selectedProp,
    });

    expect(controller.rotateSelectedProp()).toBe(true);
    expect(selectedProp.rotationQuarterTurns).toBe(1);
    expect(selectedProp.terrainPropPlacement?.rotationQuarterTurns).toBe(1);
    expect(selectedProp.terrainPropPlacement?.footprintW).toBe(2);
    expect(selectedProp.terrainPropPlacement?.footprintH).toBe(1);
    expect(selectedProp.sprite.setRotation).toHaveBeenCalledWith(Math.PI / 2);
  });

  test("deletes the selected terrain prop", () => {
    const selectedProp = createEntity({
      id: "selected-prop",
    });
    const { controller, removedEntities, selectEntity } = createHarness({
      selectedEntity: selectedProp,
    });

    expect(controller.deleteSelectedProp()).toBe(true);
    expect(removedEntities).toContain(selectedProp);
    expect(selectEntity).toHaveBeenCalledWith(null);
  });
});
