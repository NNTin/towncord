export const OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY = "officeSceneBootstrap";

export type OfficeSceneTileKind = "void" | "floor" | "wall";

export type OfficeSceneTile = {
  kind: OfficeSceneTileKind;
  tint?: number;
};

export type OfficeSceneFurniture = {
  id: string;
  label: string;
  col: number;
  row: number;
  width: number;
  height: number;
  color: number;
};

export type OfficeSceneCharacter = {
  id: string;
  label: string;
  col: number;
  row: number;
  color: number;
};

export type OfficeSceneLayout = {
  cols: number;
  rows: number;
  cellSize: number;
  tiles: OfficeSceneTile[];
  furniture: OfficeSceneFurniture[];
  characters: OfficeSceneCharacter[];
};

export type OfficeSceneBootstrap = {
  layout: OfficeSceneLayout;
};

const OFFICE_LAYOUT_ROWS = [
  "############",
  "#..........#",
  "#..##......#",
  "#..........#",
  "#...####...#",
  "#..........#",
  "#..........#",
  "############",
] as const;

function toTileKind(symbol: string): OfficeSceneTileKind {
  switch (symbol) {
    case "#":
      return "wall";
    case ".":
      return "floor";
    default:
      return "void";
  }
}

function createLayoutTiles(rows: readonly string[]): OfficeSceneTile[] {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const tiles: OfficeSceneTile[] = [];

  for (const row of rows) {
    for (let col = 0; col < cols; col += 1) {
      const symbol = row[col] ?? " ";
      const kind = toTileKind(symbol);
      if (kind === "floor") {
        tiles.push({
          kind,
          tint: 0x0f766e,
        });
        continue;
      }

      tiles.push({ kind });
    }
  }

  return tiles;
}

// Temporary scene bootstrap until the shared office domain lands on its own branch.
export function createOfficeSceneBootstrap(): OfficeSceneBootstrap {
  const cols = OFFICE_LAYOUT_ROWS.reduce((max, row) => Math.max(max, row.length), 0);
  const rows = OFFICE_LAYOUT_ROWS.length;

  return {
    layout: {
      cols,
      rows,
      cellSize: 48,
      tiles: createLayoutTiles(OFFICE_LAYOUT_ROWS),
      furniture: [
        {
          id: "desk-1",
          label: "Desk",
          col: 2,
          row: 2,
          width: 2,
          height: 1,
          color: 0xa16207,
        },
        {
          id: "table-1",
          label: "Table",
          col: 7,
          row: 4,
          width: 2,
          height: 2,
          color: 0x854d0e,
        },
        {
          id: "shelf-1",
          label: "Shelf",
          col: 9,
          row: 1,
          width: 1,
          height: 2,
          color: 0x57534e,
        },
      ],
      characters: [
        {
          id: "worker-1",
          label: "A",
          col: 4,
          row: 5,
          color: 0x60a5fa,
        },
        {
          id: "worker-2",
          label: "B",
          col: 8,
          row: 2,
          color: 0xf472b6,
        },
      ],
    },
  };
}

function isTileRecord(value: unknown): value is OfficeSceneTile {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "void" || value.kind === "floor" || value.kind === "wall")
  );
}

function isFurnitureRecord(value: unknown): value is OfficeSceneFurniture {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OfficeSceneFurniture).id === "string" &&
    typeof (value as OfficeSceneFurniture).label === "string" &&
    Number.isFinite((value as OfficeSceneFurniture).col) &&
    Number.isFinite((value as OfficeSceneFurniture).row) &&
    Number.isFinite((value as OfficeSceneFurniture).width) &&
    Number.isFinite((value as OfficeSceneFurniture).height) &&
    Number.isFinite((value as OfficeSceneFurniture).color)
  );
}

function isCharacterRecord(value: unknown): value is OfficeSceneCharacter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OfficeSceneCharacter).id === "string" &&
    typeof (value as OfficeSceneCharacter).label === "string" &&
    Number.isFinite((value as OfficeSceneCharacter).col) &&
    Number.isFinite((value as OfficeSceneCharacter).row) &&
    Number.isFinite((value as OfficeSceneCharacter).color)
  );
}

export function getOfficeSceneBootstrap(value: unknown): OfficeSceneBootstrap | null {
  if (typeof value !== "object" || value === null || !("layout" in value)) {
    return null;
  }

  const layout = value.layout;
  if (typeof layout !== "object" || layout === null) {
    return null;
  }

  const candidate = layout as Partial<OfficeSceneLayout>;
  const cols = candidate.cols;
  const rows = candidate.rows;
  const cellSize = candidate.cellSize;
  const tiles = candidate.tiles;
  const furniture = candidate.furniture;
  const characters = candidate.characters;

  if (
    typeof cols !== "number" ||
    !Number.isFinite(cols) ||
    typeof rows !== "number" ||
    !Number.isFinite(rows) ||
    typeof cellSize !== "number" ||
    !Number.isFinite(cellSize) ||
    !Array.isArray(tiles) ||
    !Array.isArray(furniture) ||
    !Array.isArray(characters)
  ) {
    return null;
  }

  if (
    !tiles.every(isTileRecord) ||
    !furniture.every(isFurnitureRecord) ||
    !characters.every(isCharacterRecord)
  ) {
    return null;
  }

  return {
    layout: {
      cols,
      rows,
      cellSize,
      tiles,
      furniture,
      characters,
    },
  };
}
