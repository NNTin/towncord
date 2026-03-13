import {
  getFurnitureCatalogEntry,
  getRotatedFurnitureType,
  getToggledFurnitureType,
  type OfficeFurnitureCatalogIndex,
} from "./catalog";
import type {
  FloorColor,
  OfficeDirection,
  OfficeLayoutDocument,
  OfficeTileType,
  PlacedFurniture,
  PlacedOfficeCharacter,
} from "./model";
import { OfficeTileType as TileType } from "./model";

export type ExpandDirection = "left" | "right" | "up" | "down";

function getTileIndex(layout: OfficeLayoutDocument, col: number, row: number): number {
  return row * layout.cols + col;
}

function getCharacters(layout: OfficeLayoutDocument): PlacedOfficeCharacter[] {
  return layout.characters ?? [];
}

function getTileColors(layout: OfficeLayoutDocument): Array<FloorColor | null> {
  return layout.tileColors ?? new Array(layout.tiles.length).fill(null);
}

function isInsideGrid(layout: OfficeLayoutDocument, col: number, row: number): boolean {
  return col >= 0 && col < layout.cols && row >= 0 && row < layout.rows;
}

function isWalkableTile(tile: OfficeTileType): boolean {
  return tile !== TileType.WALL && tile !== TileType.VOID;
}

function getFurnitureBlockedTiles(
  layout: OfficeLayoutDocument,
  index: OfficeFurnitureCatalogIndex,
  excludeUid?: string,
): Set<string> {
  const blocked = new Set<string>();

  for (const furniture of layout.furniture) {
    if (furniture.uid === excludeUid) continue;
    const entry = getFurnitureCatalogEntry(index, furniture.type);
    if (!entry) continue;

    const backgroundRows = entry.backgroundTiles ?? 0;
    for (let rowOffset = 0; rowOffset < entry.footprintH; rowOffset += 1) {
      if (rowOffset < backgroundRows) continue;
      for (let colOffset = 0; colOffset < entry.footprintW; colOffset += 1) {
        blocked.add(`${furniture.col + colOffset},${furniture.row + rowOffset}`);
      }
    }
  }

  return blocked;
}

export function paintTile(
  layout: OfficeLayoutDocument,
  col: number,
  row: number,
  tile: OfficeTileType,
  color?: FloorColor,
): OfficeLayoutDocument {
  if (!isInsideGrid(layout, col, row)) return layout;

  const index = getTileIndex(layout, col, row);
  const nextTiles = [...layout.tiles];
  const nextColors = [...getTileColors(layout)];
  const nextColor = tile === TileType.WALL || tile === TileType.VOID ? null : (color ?? nextColors[index] ?? null);

  if (nextTiles[index] === tile && nextColors[index] === nextColor) {
    return layout;
  }

  nextTiles[index] = tile;
  nextColors[index] = nextColor;
  return { ...layout, tiles: nextTiles, tileColors: nextColors };
}

export function getWallPlacementRow(
  catalog: OfficeFurnitureCatalogIndex,
  type: string,
  row: number,
): number {
  const entry = getFurnitureCatalogEntry(catalog, type);
  if (!entry?.canPlaceOnWalls) return row;
  return row - (entry.footprintH - 1);
}

export function canPlaceFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  type: string,
  col: number,
  row: number,
  excludeUid?: string,
): boolean {
  const entry = getFurnitureCatalogEntry(catalog, type);
  if (!entry) return false;

  if (entry.canPlaceOnWalls) {
    const bottomRow = row + entry.footprintH - 1;
    if (col < 0 || col + entry.footprintW > layout.cols || bottomRow < 0 || bottomRow >= layout.rows) {
      return false;
    }
  } else if (col < 0 || row < 0 || col + entry.footprintW > layout.cols || row + entry.footprintH > layout.rows) {
    return false;
  }

  const blockedTiles = getFurnitureBlockedTiles(layout, catalog, excludeUid);
  const deskTiles = new Set<string>();
  if (entry.canPlaceOnSurfaces) {
    for (const furniture of layout.furniture) {
      if (furniture.uid === excludeUid) continue;
      const furnitureEntry = getFurnitureCatalogEntry(catalog, furniture.type);
      if (!furnitureEntry?.isDesk) continue;
      for (let rowOffset = 0; rowOffset < furnitureEntry.footprintH; rowOffset += 1) {
        for (let colOffset = 0; colOffset < furnitureEntry.footprintW; colOffset += 1) {
          deskTiles.add(`${furniture.col + colOffset},${furniture.row + rowOffset}`);
        }
      }
    }
  }

  const backgroundRows = entry.backgroundTiles ?? 0;
  for (let rowOffset = 0; rowOffset < entry.footprintH; rowOffset += 1) {
    if (rowOffset < backgroundRows) continue;

    const targetRow = row + rowOffset;
    if (targetRow < 0) continue;
    const wallAnchorRow = rowOffset === entry.footprintH - 1;

    for (let colOffset = 0; colOffset < entry.footprintW; colOffset += 1) {
      const targetCol = col + colOffset;
      const targetIndex = getTileIndex(layout, targetCol, targetRow);
      const tile = layout.tiles[targetIndex];

      if (entry.canPlaceOnWalls) {
        if (wallAnchorRow) {
          const belowRow = targetRow + 1;
          const belowTile = belowRow < layout.rows
            ? layout.tiles[getTileIndex(layout, targetCol, belowRow)]
            : null;
          if (tile !== TileType.WALL && belowTile !== TileType.WALL) return false;
        }
      } else {
        if (!isWalkableTile(tile)) return false;
      }

      const key = `${targetCol},${targetRow}`;
      if (blockedTiles.has(key) && !deskTiles.has(key)) return false;
    }
  }

  return true;
}

export function placeFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  furniture: PlacedFurniture,
): OfficeLayoutDocument {
  if (!canPlaceFurniture(layout, catalog, furniture.type, furniture.col, furniture.row)) {
    return layout;
  }

  return {
    ...layout,
    furniture: [...layout.furniture, furniture],
  };
}

export function moveFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  uid: string,
  col: number,
  row: number,
): OfficeLayoutDocument {
  const current = layout.furniture.find((item) => item.uid === uid);
  if (!current) return layout;
  if (!canPlaceFurniture(layout, catalog, current.type, col, row, uid)) return layout;

  return {
    ...layout,
    furniture: layout.furniture.map((item) => (item.uid === uid ? { ...item, col, row } : item)),
  };
}

export function removeFurniture(
  layout: OfficeLayoutDocument,
  uid: string,
): OfficeLayoutDocument {
  const nextFurniture = layout.furniture.filter((item) => item.uid !== uid);
  if (nextFurniture.length === layout.furniture.length) return layout;
  return { ...layout, furniture: nextFurniture };
}

export function rotateFurniture(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  uid: string,
  direction: "cw" | "ccw",
): OfficeLayoutDocument {
  const current = layout.furniture.find((item) => item.uid === uid);
  if (!current) return layout;

  const nextType = getRotatedFurnitureType(catalog, current.type, direction);
  if (!nextType) return layout;

  return {
    ...layout,
    furniture: layout.furniture.map((item) => (item.uid === uid ? { ...item, type: nextType } : item)),
  };
}

export function toggleFurnitureState(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  uid: string,
): OfficeLayoutDocument {
  const current = layout.furniture.find((item) => item.uid === uid);
  if (!current) return layout;

  const nextType = getToggledFurnitureType(catalog, current.type);
  if (!nextType) return layout;

  return {
    ...layout,
    furniture: layout.furniture.map((item) => (item.uid === uid ? { ...item, type: nextType } : item)),
  };
}

export function canPlaceCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  col: number,
  row: number,
  excludeUid?: string,
): boolean {
  if (!isInsideGrid(layout, col, row)) return false;

  const tile = layout.tiles[getTileIndex(layout, col, row)];
  if (!isWalkableTile(tile)) return false;

  const blockedTiles = getFurnitureBlockedTiles(layout, catalog);
  if (blockedTiles.has(`${col},${row}`)) return false;

  return getCharacters(layout).every((character) =>
    character.uid === excludeUid || character.col !== col || character.row !== row,
  );
}

export function placeCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  character: PlacedOfficeCharacter,
): OfficeLayoutDocument {
  if (!canPlaceCharacter(layout, catalog, character.col, character.row)) return layout;

  return {
    ...layout,
    characters: [...getCharacters(layout), character],
  };
}

export function moveCharacter(
  layout: OfficeLayoutDocument,
  catalog: OfficeFurnitureCatalogIndex,
  uid: string,
  col: number,
  row: number,
): OfficeLayoutDocument {
  if (!canPlaceCharacter(layout, catalog, col, row, uid)) return layout;

  return {
    ...layout,
    characters: getCharacters(layout).map((character) =>
      character.uid === uid ? { ...character, col, row } : character,
    ),
  };
}

export function removeCharacter(
  layout: OfficeLayoutDocument,
  uid: string,
): OfficeLayoutDocument {
  const nextCharacters = getCharacters(layout).filter((character) => character.uid !== uid);
  if (nextCharacters.length === getCharacters(layout).length) return layout;
  return { ...layout, characters: nextCharacters };
}

export function setCharacterPose(
  layout: OfficeLayoutDocument,
  uid: string,
  pose: PlacedOfficeCharacter["pose"],
): OfficeLayoutDocument {
  return {
    ...layout,
    characters: getCharacters(layout).map((character) =>
      character.uid === uid ? { ...character, pose } : character,
    ),
  };
}

export function setCharacterDirection(
  layout: OfficeLayoutDocument,
  uid: string,
  direction: OfficeDirection,
): OfficeLayoutDocument {
  return {
    ...layout,
    characters: getCharacters(layout).map((character) =>
      character.uid === uid ? { ...character, direction } : character,
    ),
  };
}

export function expandLayout(
  layout: OfficeLayoutDocument,
  direction: ExpandDirection,
): { layout: OfficeLayoutDocument; shift: { col: number; row: number } } {
  let nextCols = layout.cols;
  let nextRows = layout.rows;
  let shiftCol = 0;
  let shiftRow = 0;

  if (direction === "left") {
    nextCols += 1;
    shiftCol = 1;
  } else if (direction === "right") {
    nextCols += 1;
  } else if (direction === "up") {
    nextRows += 1;
    shiftRow = 1;
  } else {
    nextRows += 1;
  }

  const nextTiles = new Array<OfficeTileType>(nextCols * nextRows).fill(TileType.VOID);
  const nextColors = new Array<FloorColor | null>(nextCols * nextRows).fill(null);
  const colors = getTileColors(layout);

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const oldIndex = row * layout.cols + col;
      const nextIndex = (row + shiftRow) * nextCols + (col + shiftCol);
      nextTiles[nextIndex] = layout.tiles[oldIndex]!;
      nextColors[nextIndex] = colors[oldIndex] ?? null;
    }
  }

  return {
    layout: {
      ...layout,
      cols: nextCols,
      rows: nextRows,
      tiles: nextTiles,
      tileColors: nextColors,
      furniture: layout.furniture.map((item) => ({
        ...item,
        col: item.col + shiftCol,
        row: item.row + shiftRow,
      })),
      characters: getCharacters(layout).map((character) => ({
        ...character,
        col: character.col + shiftCol,
        row: character.row + shiftRow,
      })),
    },
    shift: {
      col: shiftCol,
      row: shiftRow,
    },
  };
}
