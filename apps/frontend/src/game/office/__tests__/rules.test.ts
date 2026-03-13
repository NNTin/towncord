import { describe, expect, test } from "vitest";
import {
  applyOfficeLayoutAction,
  createOfficeLayoutDocument,
  getWallPlacementOffset,
  placeOfficeCharacter,
  placeOfficeFurniture,
  type OfficeFurnitureInstance,
  type OfficeLayoutDocument,
  type OfficePlacedCharacter,
} from "../index";

function createLayout(): OfficeLayoutDocument {
  return createOfficeLayoutDocument({
    columns: 5,
    rows: 5,
    defaultTileColor: "neutral",
  });
}

function createDesk(id: string, x: number, y: number): OfficeFurnitureInstance {
  return {
    id,
    kind: "desk",
    label: "Desk",
    rotation: 0,
    anchor: {
      kind: "floor",
      position: { x, y },
    },
    geometry: {
      floor: {
        width: 2,
        height: 1,
      },
      surfaces: [
        {
          id: "desktop",
          x: 0.1,
          y: 0.1,
          width: 1.8,
          height: 0.8,
        },
      ],
    },
    collision: {
      blocksMovement: true,
      blocksPlacement: true,
    },
    toggles: {},
  };
}

function createLocker(id: string, x: number, y: number): OfficeFurnitureInstance {
  return {
    id,
    kind: "locker",
    label: "Locker",
    rotation: 0,
    anchor: {
      kind: "floor",
      position: { x, y },
    },
    geometry: {
      floor: {
        width: 1,
        height: 1,
      },
    },
    collision: {
      blocksMovement: true,
      blocksPlacement: true,
    },
    toggles: {
      locked: false,
    },
  };
}

function createWallShelf(
  id: string,
  x: number,
  y: number,
  offset: number,
): OfficeFurnitureInstance {
  return {
    id,
    kind: "wallShelf",
    label: "Wall Shelf",
    rotation: 0,
    anchor: {
      kind: "wall",
      position: { x, y },
      wall: "north",
      offset,
    },
    geometry: {
      wall: {
        span: 0.6,
      },
    },
    collision: {
      blocksMovement: false,
      blocksPlacement: true,
    },
    toggles: {},
  };
}

function createDeskItem(
  id: string,
  parentFurnitureId: string,
  x: number,
  y: number,
): OfficeFurnitureInstance {
  return {
    id,
    kind: "deskItem",
    label: "Desk Item",
    rotation: 0,
    anchor: {
      kind: "surface",
      parentFurnitureId,
      surfaceId: "desktop",
      x,
      y,
    },
    geometry: {
      surface: {
        width: 0.5,
        height: 0.4,
      },
    },
    collision: {
      blocksMovement: false,
      blocksPlacement: true,
    },
    toggles: {},
  };
}

function createCharacter(id: string, x: number, y: number): OfficePlacedCharacter {
  return {
    id,
    kind: "worker",
    label: "Worker",
    position: { x, y },
    facing: "south",
    collision: {
      blocksMovement: true,
      blocksPlacement: true,
    },
    state: {},
  };
}

describe("office layout rules", () => {
  test("paints and erases tile colors through actions", () => {
    const layout = createLayout();

    const painted = applyOfficeLayoutAction(layout, {
      type: "paintTile",
      position: { x: 2, y: 3 },
      color: "blue",
    });

    expect(painted.ok).toBe(true);
    if (!painted.ok) return;
    expect(painted.value.grid.tiles["2,3"]?.color).toBe("blue");

    const erased = applyOfficeLayoutAction(painted.value, {
      type: "eraseTile",
      position: { x: 2, y: 3 },
    });

    expect(erased.ok).toBe(true);
    if (!erased.ok) return;
    expect(erased.value.grid.tiles["2,3"]?.color).toBe("neutral");
  });

  test("blocks overlapping floor furniture and supports move/rotate/toggle", () => {
    const layout = createLayout();
    const withDesk = placeOfficeFurniture(layout, createDesk("desk-1", 1, 1));
    expect(withDesk.ok).toBe(true);
    if (!withDesk.ok) return;

    const blockedLocker = placeOfficeFurniture(withDesk.value, createLocker("locker-1", 1, 1));
    expect(blockedLocker.ok).toBe(false);
    if (blockedLocker.ok) return;
    expect(blockedLocker.error.code).toBe("furniture-placement-blocked");

    const moved = applyOfficeLayoutAction(withDesk.value, {
      type: "moveFurniture",
      furnitureId: "desk-1",
      anchor: {
        kind: "floor",
        position: { x: 2, y: 2 },
      },
    });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.furniture["desk-1"]?.anchor).toEqual({
      kind: "floor",
      position: { x: 2, y: 2 },
    });

    const rotated = applyOfficeLayoutAction(moved.value, {
      type: "rotateFurniture",
      furnitureId: "desk-1",
    });

    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    expect(rotated.value.furniture["desk-1"]?.rotation).toBe(90);

    const toggled = applyOfficeLayoutAction(rotated.value, {
      type: "toggleFurnitureState",
      furnitureId: "desk-1",
      stateId: "lampOn",
    });

    expect(toggled.ok).toBe(true);
    if (!toggled.ok) return;
    expect(toggled.value.furniture["desk-1"]?.toggles.lampOn).toBe(true);
  });

  test("computes wall offsets and rejects overlapping wall placements", () => {
    expect(getWallPlacementOffset("east", 0.25)).toEqual({
      x: 0.5,
      y: 0.25,
    });

    const layout = createLayout();
    const shelfA = placeOfficeFurniture(layout, createWallShelf("shelf-a", 2, 2, 0));
    expect(shelfA.ok).toBe(true);
    if (!shelfA.ok) return;

    const shelfB = placeOfficeFurniture(shelfA.value, createWallShelf("shelf-b", 2, 2, 0.1));
    expect(shelfB.ok).toBe(false);
    if (shelfB.ok) return;
    expect(shelfB.error.code).toBe("furniture-placement-blocked");

    const shelfC = placeOfficeFurniture(shelfA.value, {
      ...createWallShelf("shelf-c", 2, 2, 0.1),
      anchor: {
        kind: "wall",
        position: { x: 2, y: 2 },
        wall: "south",
        offset: 0.1,
      },
    });
    expect(shelfC.ok).toBe(true);
  });

  test("supports desk-surface placement and cascades child removal", () => {
    const layout = createLayout();
    const withDesk = placeOfficeFurniture(layout, createDesk("desk-1", 1, 1));
    expect(withDesk.ok).toBe(true);
    if (!withDesk.ok) return;

    const withLaptop = placeOfficeFurniture(withDesk.value, createDeskItem("laptop", "desk-1", 0.2, 0.2));
    expect(withLaptop.ok).toBe(true);
    if (!withLaptop.ok) return;

    const overlapping = placeOfficeFurniture(withLaptop.value, createDeskItem("phone", "desk-1", 0.3, 0.2));
    expect(overlapping.ok).toBe(false);
    if (overlapping.ok) return;
    expect(overlapping.error.code).toBe("surface-placement-blocked");

    const removed = applyOfficeLayoutAction(withLaptop.value, {
      type: "removeFurniture",
      furnitureId: "desk-1",
    });

    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.furniture["desk-1"]).toBeUndefined();
    expect(removed.value.furniture.laptop).toBeUndefined();
  });

  test("blocks characters on furniture and shifts entities during grid expansion", () => {
    const base = createLayout();
    const withDesk = placeOfficeFurniture(base, createDesk("desk-1", 1, 1));
    expect(withDesk.ok).toBe(true);
    if (!withDesk.ok) return;

    const withCharacter = placeOfficeCharacter(withDesk.value, createCharacter("worker-1", 0, 0));
    expect(withCharacter.ok).toBe(true);
    if (!withCharacter.ok) return;

    const blockedMove = applyOfficeLayoutAction(withCharacter.value, {
      type: "moveCharacter",
      characterId: "worker-1",
      position: { x: 1, y: 1 },
    });
    expect(blockedMove.ok).toBe(false);
    if (blockedMove.ok) return;
    expect(blockedMove.error.code).toBe("character-position-blocked");

    const painted = applyOfficeLayoutAction(withCharacter.value, {
      type: "paintTile",
      position: { x: 0, y: 0 },
      color: "green",
    });
    expect(painted.ok).toBe(true);
    if (!painted.ok) return;

    const expanded = applyOfficeLayoutAction(painted.value, {
      type: "expandGrid",
      expansion: {
        top: 2,
        left: 1,
      },
    });

    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    expect(expanded.value.grid.columns).toBe(6);
    expect(expanded.value.grid.rows).toBe(7);
    expect(expanded.value.furniture["desk-1"]?.anchor).toEqual({
      kind: "floor",
      position: { x: 2, y: 3 },
    });
    expect(expanded.value.characters["worker-1"]?.position).toEqual({ x: 1, y: 2 });
    expect(expanded.value.grid.tiles["1,2"]?.color).toBe("green");
  });
});
