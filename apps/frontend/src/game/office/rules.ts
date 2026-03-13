import {
  DEFAULT_OFFICE_FLOOR_COLOR,
  OFFICE_LAYOUT_VERSION,
  OFFICE_TILE_TYPE,
  type ExpandDirection,
  type OfficeCatalog,
  type OfficeCharacterDirection,
  type OfficeCharacterPose,
  type OfficeColorAdjustment,
  type OfficeFurnitureInstance,
  type OfficeLayoutDocument,
  type OfficePlacedCharacter,
  type OfficePlacedFurniture,
  getOfficeCharacters,
  getOfficeTileIndex,
  isOfficeTileInBounds,
} from "./model";
import {
  getOfficeFurnitureEntry,
  getRotatedOfficeFurnitureType,
  getToggledOfficeFurnitureType,
} from "./catalog";

function cloneTileColors(
  layout: OfficeLayoutDocument,
): Array<OfficeColorAdjustment | null> {
  return [...(layout.tileColors ?? Array.from({ length: layout.tiles.length }, () => null))];
}

function normalizeColorForTile(
  tileType: number,
  color: OfficeColorAdjustment | null | undefined,
): OfficeColorAdjustment | null {
  if (tileType === OFFICE_TILE_TYPE.WALL || tileType === OFFICE_TILE_TYPE.VOID) {
    return null;
  }
  return color ? { ...color } : { ...DEFAULT_OFFICE_FLOOR_COLOR };
}

function withCharacters(
  layout: OfficeLayoutDocument,
  characters: OfficePlacedCharacter[],
): OfficeLayoutDocument {
  return {
    ...layout,
    ...(characters.length > 0 ? { characters } : { characters: [] }),
  };
}

export function paintOfficeTile(
  layout: OfficeLayoutDocument,
  col: number,
  row: number,
  tileType: number,
  color?: OfficeColorAdjustment | null,
): OfficeLayoutDocument {
  if (!isOfficeTileInBounds(layout, col, row)) return layout;

  const index = getOfficeTileIndex(layout, col, row);
  const tileColors = cloneTileColors(layout);
  const nextColor = normalizeColorForTile(tileType, color);
  const currentColor = tileColors[index];

  const colorChanged =
    currentColor?.h !== nextColor?.h ||
    currentColor?.s !== nextColor?.s ||
    currentColor?.b !== nextColor?.b ||
    currentColor?.c !== nextColor?.c ||
    currentColor?.colorize !== nextColor?.colorize;

  if (layout.tiles[index] === tileType && !colorChanged) {
    return layout;
  }

  const tiles = [...layout.tiles];
  tiles[index] = tileType as OfficeLayoutDocument["tiles"][number];
  tileColors[index] = nextColor;

  return {
    ...layout,
    tiles,
    tileColors,
  };
}

export function eraseOfficeTile(
  layout: OfficeLayoutDocument,
  col: number,
  row: number,
): OfficeLayoutDocument {
  return paintOfficeTile(layout, col, row, OFFICE_TILE_TYPE.VOID, null);
}

export function removeOfficeFurniture(
  layout: OfficeLayoutDocument,
  uid: string,
): OfficeLayoutDocument {
  const nextFurniture = layout.furniture.filter((item) => item.uid !== uid);
  if (nextFurniture.length === layout.furniture.length) return layout;

  return {
    ...layout,
    furniture: nextFurniture,
  };
}

export function getWallPlacementRow(
  catalog: OfficeCatalog,
  type: string,
  row: number,
): number {
  const entry = getOfficeFurnitureEntry(catalog, type);
  if (!entry?.canPlaceOnWalls) return row;
  return row - (entry.footprintH - 1);
}

export function getFurnitureBlockedTiles(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  excludeUid?: string,
): Set<string> {
  const blocked = new Set<string>();

  for (const item of layout.furniture) {
    if (item.uid === excludeUid) continue;
    const entry = getOfficeFurnitureEntry(catalog, item.type);
    if (!entry) continue;

    for (let rowOffset = entry.backgroundTiles; rowOffset < entry.footprintH; rowOffset += 1) {
      const row = item.row + rowOffset;
      if (row < 0) continue;
      for (let colOffset = 0; colOffset < entry.footprintW; colOffset += 1) {
        blocked.add(`${item.col + colOffset},${row}`);
      }
    }
  }

  return blocked;
}

export function getCharacterOccupiedTiles(
  layout: OfficeLayoutDocument,
  excludeUid?: string,
): Set<string> {
  const occupied = new Set<string>();
  for (const character of getOfficeCharacters(layout)) {
    if (character.uid === excludeUid) continue;
    occupied.add(`${character.col},${character.row}`);
  }
  return occupied;
}

export function getPlacementBlockedTiles(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  excludeFurnitureUid?: string,
): Set<string> {
  const blocked = getFurnitureBlockedTiles(layout, catalog, excludeFurnitureUid);
  for (const key of getCharacterOccupiedTiles(layout)) {
    blocked.add(key);
  }
  return blocked;
}

function isWallPlacementValid(
  layout: OfficeLayoutDocument,
  col: number,
  row: number,
  footprintW: number,
  footprintH: number,
): boolean {
  const bottomRow = row + footprintH - 1;
  if (col < 0 || col + footprintW > layout.cols || bottomRow < 0 || bottomRow >= layout.rows) {
    return false;
  }

  for (let rowOffset = 0; rowOffset < footprintH; rowOffset += 1) {
    const currentRow = row + rowOffset;
    if (currentRow < 0) continue;
    const isBottomFootprintRow = rowOffset === footprintH - 1;

    for (let colOffset = 0; colOffset < footprintW; colOffset += 1) {
      const index = getOfficeTileIndex(layout, col + colOffset, currentRow);
      const tile = layout.tiles[index];

      if (!isBottomFootprintRow) {
        continue;
      }

      if (tile === OFFICE_TILE_TYPE.WALL) {
        continue;
      }

      const belowRow = currentRow + 1;
      if (belowRow >= layout.rows) return false;
      const belowIndex = getOfficeTileIndex(layout, col + colOffset, belowRow);
      if (layout.tiles[belowIndex] !== OFFICE_TILE_TYPE.WALL) {
        return false;
      }
    }
  }

  return true;
}

export function canPlaceOfficeFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  type: string,
  col: number,
  row: number,
  excludeUid?: string,
): boolean {
  const entry = getOfficeFurnitureEntry(catalog, type);
  if (!entry) return false;

  if (entry.canPlaceOnWalls) {
    if (!isWallPlacementValid(layout, col, row, entry.footprintW, entry.footprintH)) {
      return false;
    }
  } else if (
    col < 0 ||
    row < 0 ||
    col + entry.footprintW > layout.cols ||
    row + entry.footprintH > layout.rows
  ) {
    return false;
  }

  const blockedTiles = getPlacementBlockedTiles(layout, catalog, excludeUid);
  let deskTiles: Set<string> | null = null;

  if (entry.canPlaceOnSurfaces) {
    deskTiles = new Set<string>();
    for (const item of layout.furniture) {
      if (item.uid === excludeUid) continue;
      const furnitureEntry = getOfficeFurnitureEntry(catalog, item.type);
      if (!furnitureEntry?.isDesk) continue;

      for (let rowOffset = 0; rowOffset < furnitureEntry.footprintH; rowOffset += 1) {
        for (let colOffset = 0; colOffset < furnitureEntry.footprintW; colOffset += 1) {
          deskTiles.add(`${item.col + colOffset},${item.row + rowOffset}`);
        }
      }
    }
  }

  for (let rowOffset = 0; rowOffset < entry.footprintH; rowOffset += 1) {
    const currentRow = row + rowOffset;
    if (currentRow < 0) continue;
    if (rowOffset < entry.backgroundTiles) continue;

    const ignoreTileValidity = entry.canPlaceOnWalls && rowOffset < entry.footprintH - 1;

    for (let colOffset = 0; colOffset < entry.footprintW; colOffset += 1) {
      const currentCol = col + colOffset;
      const tileKey = `${currentCol},${currentRow}`;

      if (entry.canPlaceOnSurfaces && !deskTiles?.has(tileKey)) {
        return false;
      }

      if (!ignoreTileValidity) {
        const index = getOfficeTileIndex(layout, currentCol, currentRow);
        const tile = layout.tiles[index];
        if (!entry.canPlaceOnWalls) {
          if (tile === OFFICE_TILE_TYPE.VOID) return false;
          if (tile === OFFICE_TILE_TYPE.WALL) return false;
        }
      }

      if (blockedTiles.has(tileKey) && !(deskTiles?.has(tileKey))) {
        return false;
      }
    }
  }

  return true;
}

export function placeOfficeFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  furniture: OfficePlacedFurniture,
): OfficeLayoutDocument {
  if (
    !canPlaceOfficeFurniture(
      layout,
      catalog,
      furniture.type,
      furniture.col,
      furniture.row,
      undefined,
    )
  ) {
    return layout;
  }

  return {
    ...layout,
    furniture: [...layout.furniture, furniture],
  };
}

export function moveOfficeFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  uid: string,
  col: number,
  row: number,
): OfficeLayoutDocument {
  const item = layout.furniture.find((candidate) => candidate.uid === uid);
  if (!item) return layout;
  if (!canPlaceOfficeFurniture(layout, catalog, item.type, col, row, uid)) {
    return layout;
  }

  return {
    ...layout,
    furniture: layout.furniture.map((candidate) =>
      candidate.uid === uid ? { ...candidate, col, row } : candidate,
    ),
  };
}

export function rotateOfficeFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  uid: string,
  direction: "cw" | "ccw",
): OfficeLayoutDocument {
  const item = layout.furniture.find((candidate) => candidate.uid === uid);
  if (!item) return layout;

  const nextType = getRotatedOfficeFurnitureType(catalog, item.type, direction);
  if (!nextType) return layout;
  if (!canPlaceOfficeFurniture(layout, catalog, nextType, item.col, item.row, uid)) {
    return layout;
  }

  return {
    ...layout,
    furniture: layout.furniture.map((candidate) =>
      candidate.uid === uid ? { ...candidate, type: nextType } : candidate,
    ),
  };
}

export function toggleOfficeFurnitureState(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  uid: string,
): OfficeLayoutDocument {
  const item = layout.furniture.find((candidate) => candidate.uid === uid);
  if (!item) return layout;

  const nextType = getToggledOfficeFurnitureType(catalog, item.type);
  if (!nextType) return layout;
  if (!canPlaceOfficeFurniture(layout, catalog, nextType, item.col, item.row, uid)) {
    return layout;
  }

  return {
    ...layout,
    furniture: layout.furniture.map((candidate) =>
      candidate.uid === uid ? { ...candidate, type: nextType } : candidate,
    ),
  };
}

export function canPlaceOfficeCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  col: number,
  row: number,
  excludeUid?: string,
): boolean {
  if (!isOfficeTileInBounds(layout, col, row)) return false;

  const index = getOfficeTileIndex(layout, col, row);
  const tile = layout.tiles[index];
  if (tile === OFFICE_TILE_TYPE.WALL || tile === OFFICE_TILE_TYPE.VOID) {
    return false;
  }

  const furnitureBlocked = getFurnitureBlockedTiles(layout, catalog);
  if (furnitureBlocked.has(`${col},${row}`)) {
    return false;
  }

  return !getCharacterOccupiedTiles(layout, excludeUid).has(`${col},${row}`);
}

export function placeOfficeCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  character: OfficePlacedCharacter,
): OfficeLayoutDocument {
  if (!canPlaceOfficeCharacter(layout, catalog, character.col, character.row)) {
    return layout;
  }

  return withCharacters(layout, [...getOfficeCharacters(layout), character]);
}

export function moveOfficeCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
  uid: string,
  col: number,
  row: number,
): OfficeLayoutDocument {
  const characters = [...getOfficeCharacters(layout)];
  const index = characters.findIndex((candidate) => candidate.uid === uid);
  if (index < 0) return layout;
  if (!canPlaceOfficeCharacter(layout, catalog, col, row, uid)) {
    return layout;
  }

  characters[index] = {
    ...characters[index]!,
    col,
    row,
  };

  return withCharacters(layout, characters);
}

export function removeOfficeCharacter(
  layout: OfficeLayoutDocument,
  uid: string,
): OfficeLayoutDocument {
  const nextCharacters = getOfficeCharacters(layout).filter(
    (character) => character.uid !== uid,
  );
  if (nextCharacters.length === getOfficeCharacters(layout).length) return layout;
  return withCharacters(layout, [...nextCharacters]);
}

export function updateOfficeCharacter(
  layout: OfficeLayoutDocument,
  uid: string,
  patch: Partial<Pick<OfficePlacedCharacter, "paletteVariant" | "pose" | "direction">>,
): OfficeLayoutDocument {
  const characters = [...getOfficeCharacters(layout)];
  const index = characters.findIndex((candidate) => candidate.uid === uid);
  if (index < 0) return layout;

  const current = characters[index]!;
  characters[index] = {
    ...current,
    ...patch,
  };

  return withCharacters(layout, characters);
}

export function expandOfficeLayout(
  layout: OfficeLayoutDocument,
  direction: ExpandDirection,
): {
  layout: OfficeLayoutDocument;
  shift: { col: number; row: number };
} {
  let cols = layout.cols;
  let rows = layout.rows;
  let shiftCol = 0;
  let shiftRow = 0;

  switch (direction) {
    case "left":
      cols += 1;
      shiftCol = 1;
      break;
    case "right":
      cols += 1;
      break;
    case "up":
      rows += 1;
      shiftRow = 1;
      break;
    case "down":
      rows += 1;
      break;
  }

  const tiles: OfficeLayoutDocument["tiles"] = Array.from(
    { length: cols * rows },
    () => OFFICE_TILE_TYPE.VOID,
  ) as OfficeLayoutDocument["tiles"];
  const tileColors: Array<OfficeColorAdjustment | null> = Array.from(
    { length: cols * rows },
    () => null as OfficeColorAdjustment | null,
  );
  const existingTileColors = cloneTileColors(layout);

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const sourceIndex = getOfficeTileIndex(layout, col, row);
      const targetIndex = (row + shiftRow) * cols + (col + shiftCol);
      tiles[targetIndex] = layout.tiles[sourceIndex]!;
      tileColors[targetIndex] = existingTileColors[sourceIndex]!;
    }
  }

  return {
    layout: {
      version: OFFICE_LAYOUT_VERSION,
      cols,
      rows,
      tiles,
      tileColors,
      furniture: layout.furniture.map((item) => ({
        ...item,
        col: item.col + shiftCol,
        row: item.row + shiftRow,
      })),
      characters: getOfficeCharacters(layout).map((character) => ({
        ...character,
        col: character.col + shiftCol,
        row: character.row + shiftRow,
      })),
    },
    shift: { col: shiftCol, row: shiftRow },
  };
}

export function resolveOfficeFurnitureInstances(
  layout: OfficeLayoutDocument,
  catalog: OfficeCatalog,
): OfficeFurnitureInstance[] {
  return layout.furniture
    .map((item) => {
      const entry = getOfficeFurnitureEntry(catalog, item.type);
      if (!entry) return null;
      return {
        ...item,
        entry,
      };
    })
    .filter((item): item is OfficeFurnitureInstance => Boolean(item));
}

export function createEmptyOfficeLayout(
  cols: number,
  rows: number,
): OfficeLayoutDocument {
  return {
    version: OFFICE_LAYOUT_VERSION,
    cols,
    rows,
    tiles: Array.from({ length: cols * rows }, () => OFFICE_TILE_TYPE.VOID),
    tileColors: Array.from({ length: cols * rows }, () => null),
    furniture: [],
    characters: [],
  };
}

export function createOfficeCharacter(
  uid: string,
  col: number,
  row: number,
  options: Partial<{
    characterType: string;
    paletteVariant: string;
    pose: OfficeCharacterPose;
    direction: OfficeCharacterDirection;
  }> = {},
): OfficePlacedCharacter {
  return {
    uid,
    characterType: options.characterType ?? "office-worker",
    paletteVariant: options.paletteVariant ?? "palette-0",
    pose: options.pose ?? "idle",
    direction: options.direction ?? "down",
    col,
    row,
  };
}
