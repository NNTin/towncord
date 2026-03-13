import {
  OFFICE_TILE_TYPE,
  type OfficeLayoutDocument,
} from "../../office";

export const OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY = "office.sceneBootstrap";

export type OfficeSceneBootstrap = {
  layout: OfficeLayoutDocument;
};

const OFFICE_SCENE_LAYOUT_FIXTURE: OfficeLayoutDocument = {
  version: 1,
  cols: 12,
  rows: 8,
  tiles: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 2, 2, 2, 1, 1, 1, 7, 7, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 7, 7, 1,
    8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1,
  ].map((value) => value as OfficeLayoutDocument["tiles"][number]),
  tileColors: [
    ...new Array(12).fill(null),
    ...new Array(12).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(3).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(3).fill({ h: 190, s: 26, b: -5, c: 0 }),
    ...new Array(6).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(3).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(3).fill({ h: 190, s: 26, b: -5, c: 0 }),
    ...new Array(3).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(2).fill({ h: 296, s: 35, b: -10, c: 0 }),
    ...new Array(1).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(9).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(2).fill({ h: 296, s: 35, b: -10, c: 0 }),
    ...new Array(1).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(2).fill(null),
    ...new Array(10).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(2).fill(null),
    ...new Array(10).fill({ h: 34, s: 38, b: 8, c: 0 }),
    ...new Array(4).fill(null),
    ...new Array(8).fill({ h: 34, s: 38, b: 8, c: 0 }),
  ],
  furniture: [
    { uid: "desk-1", type: "desk.front.off", col: 4, row: 2 },
    { uid: "desk-2", type: "desk.front.off", col: 7, row: 2 },
  ],
  characters: [
    {
      uid: "worker-1",
      characterType: "office-worker",
      paletteVariant: "palette-0",
      pose: "idle",
      direction: "down",
      col: 5,
      row: 4,
    },
    {
      uid: "worker-2",
      characterType: "office-worker",
      paletteVariant: "palette-1",
      pose: "read",
      direction: "right",
      col: 8,
      row: 4,
    },
  ],
};

export function createOfficeSceneBootstrap(): OfficeSceneBootstrap {
  return {
    layout: OFFICE_SCENE_LAYOUT_FIXTURE,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getOfficeSceneBootstrap(value: unknown): OfficeSceneBootstrap | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  if (!("layout" in value)) {
    return null;
  }

  return value as OfficeSceneBootstrap;
}

export function isOfficeTileValue(value: unknown): value is OfficeLayoutDocument["tiles"][number] {
  return typeof value === "number" && Object.values(OFFICE_TILE_TYPE).includes(value as never);
}
