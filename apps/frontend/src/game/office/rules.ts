import {
  OFFICE_LAYOUT_DOCUMENT_VERSION,
  type OfficeCharacterId,
  type OfficeFurnitureAnchor,
  type OfficeFurnitureId,
  type OfficeFurnitureInstance,
  type OfficeGridExpansion,
  type OfficeGridPosition,
  type OfficeLayoutAction,
  type OfficeLayoutCreateInput,
  type OfficeLayoutDocument,
  type OfficePlacedCharacter,
  type OfficeTile,
  type OfficeTileColor,
} from "./model";
import {
  getFurnitureFloorSize,
  getFurnitureFloorTiles,
  getFurnitureSurfaceRect,
  getSurfacePlacementRect,
  getWallInterval,
  rectContainsRect,
  rectsOverlap,
  rotateOfficeRotation,
  toOfficeTileKey,
} from "./geometry";

type OfficeErrorCode =
  | "character-not-found"
  | "character-position-blocked"
  | "character-position-out-of-bounds"
  | "duplicate-character"
  | "duplicate-furniture"
  | "furniture-anchor-invalid"
  | "furniture-not-found"
  | "furniture-placement-blocked"
  | "furniture-position-out-of-bounds"
  | "grid-expansion-invalid"
  | "parent-furniture-not-found"
  | "surface-not-found"
  | "surface-placement-blocked"
  | "tile-out-of-bounds";

type OfficeLayoutError = {
  code: OfficeErrorCode;
  message: string;
};

type OfficeLayoutResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: OfficeLayoutError;
    };

const DEFAULT_TILE_COLOR: OfficeTileColor = "neutral";
const DEFAULT_TOGGLE_ID = "active";

export function createOfficeLayoutDocument(input: OfficeLayoutCreateInput): OfficeLayoutDocument {
  const defaultTileColor = input.defaultTileColor ?? DEFAULT_TILE_COLOR;
  const tiles: OfficeLayoutDocument["grid"]["tiles"] = {};

  for (let y = 0; y < input.rows; y += 1) {
    for (let x = 0; x < input.columns; x += 1) {
      const key = toOfficeTileKey(x, y);
      tiles[key] = {
        position: { x, y },
        color: defaultTileColor,
      };
    }
  }

  return {
    version: OFFICE_LAYOUT_DOCUMENT_VERSION,
    grid: {
      columns: input.columns,
      rows: input.rows,
      defaultTileColor,
      tiles,
    },
    furniture: {},
    characters: {},
  };
}

export function applyOfficeLayoutAction(
  layout: OfficeLayoutDocument,
  action: OfficeLayoutAction,
): OfficeLayoutResult<OfficeLayoutDocument> {
  switch (action.type) {
    case "paintTile":
      return paintOfficeTile(layout, action.position, action.color);
    case "eraseTile":
      return eraseOfficeTile(layout, action.position);
    case "placeFurniture":
      return placeOfficeFurniture(layout, action.furniture);
    case "moveFurniture":
      return moveOfficeFurniture(layout, action.furnitureId, action.anchor);
    case "rotateFurniture":
      return rotateOfficeFurniture(layout, action.furnitureId, action.direction);
    case "toggleFurnitureState":
      return toggleOfficeFurnitureState(layout, action.furnitureId, action.stateId);
    case "removeFurniture":
      return removeOfficeFurniture(layout, action.furnitureId);
    case "placeCharacter":
      return placeOfficeCharacter(layout, action.character);
    case "moveCharacter":
      return moveOfficeCharacter(layout, action.characterId, action.position);
    case "removeCharacter":
      return removeOfficeCharacter(layout, action.characterId);
    case "expandGrid":
      return expandOfficeLayout(layout, action.expansion);
  }
}

function paintOfficeTile(
  layout: OfficeLayoutDocument,
  position: OfficeGridPosition,
  color: OfficeTileColor,
): OfficeLayoutResult<OfficeLayoutDocument> {
  const tile = getTile(layout, position);
  if (!tile) {
    return failure("tile-out-of-bounds", "Tile is outside the office grid.");
  }

  if (tile.color === color) {
    return success(layout);
  }

  const nextTile: OfficeTile = {
    ...tile,
    color,
  };

  return success({
    ...layout,
    grid: {
      ...layout.grid,
      tiles: {
        ...layout.grid.tiles,
        [toOfficeTileKey(position.x, position.y)]: nextTile,
      },
    },
  });
}

function eraseOfficeTile(
  layout: OfficeLayoutDocument,
  position: OfficeGridPosition,
): OfficeLayoutResult<OfficeLayoutDocument> {
  return paintOfficeTile(layout, position, layout.grid.defaultTileColor);
}

function expandOfficeLayout(
  layout: OfficeLayoutDocument,
  expansion: OfficeGridExpansion,
): OfficeLayoutResult<OfficeLayoutDocument> {
  const top = expansion.top ?? 0;
  const right = expansion.right ?? 0;
  const bottom = expansion.bottom ?? 0;
  const left = expansion.left ?? 0;

  if ([top, right, bottom, left].some((value) => value < 0 || !Number.isInteger(value))) {
    return failure("grid-expansion-invalid", "Grid expansion must use non-negative integers.");
  }

  const nextColumns = layout.grid.columns + left + right;
  const nextRows = layout.grid.rows + top + bottom;
  const fillColor = expansion.fillColor ?? layout.grid.defaultTileColor;

  const expanded = createOfficeLayoutDocument({
    columns: nextColumns,
    rows: nextRows,
    defaultTileColor: layout.grid.defaultTileColor,
  });

  for (const tile of Object.values(expanded.grid.tiles)) {
    tile.color = fillColor;
  }

  for (const tile of Object.values(layout.grid.tiles)) {
    expanded.grid.tiles[toOfficeTileKey(tile.position.x + left, tile.position.y + top)] = {
      position: {
        x: tile.position.x + left,
        y: tile.position.y + top,
      },
      color: tile.color,
    };
  }

  const furniture = Object.fromEntries(
    Object.values(layout.furniture).map((item) => [item.id, translateFurniture(item, left, top)]),
  ) as OfficeLayoutDocument["furniture"];

  const characters = Object.fromEntries(
    Object.values(layout.characters).map((character) => [
      character.id,
      {
        ...character,
        position: {
          x: character.position.x + left,
          y: character.position.y + top,
        },
      },
    ]),
  ) as OfficeLayoutDocument["characters"];

  return success({
    ...expanded,
    furniture,
    characters,
  });
}

export function placeOfficeFurniture(
  layout: OfficeLayoutDocument,
  furniture: OfficeFurnitureInstance,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (layout.furniture[furniture.id]) {
    return failure("duplicate-furniture", `Furniture "${furniture.id}" already exists.`);
  }

  const validation = validateFurniturePlacement(layout, furniture);
  if (!validation.ok) {
    return validation;
  }

  return success({
    ...layout,
    furniture: {
      ...layout.furniture,
      [furniture.id]: furniture,
    },
  });
}

function moveOfficeFurniture(
  layout: OfficeLayoutDocument,
  furnitureId: OfficeFurnitureId,
  anchor: OfficeFurnitureAnchor,
): OfficeLayoutResult<OfficeLayoutDocument> {
  const current = layout.furniture[furnitureId];
  if (!current) {
    return failure("furniture-not-found", `Furniture "${furnitureId}" was not found.`);
  }

  const candidate: OfficeFurnitureInstance = {
    ...current,
    anchor,
  };

  const validation = validateFurniturePlacement(layout, candidate, furnitureId);
  if (!validation.ok) {
    return validation;
  }

  return success({
    ...layout,
    furniture: {
      ...layout.furniture,
      [furnitureId]: candidate,
    },
  });
}

function rotateOfficeFurniture(
  layout: OfficeLayoutDocument,
  furnitureId: OfficeFurnitureId,
  direction: "clockwise" | "counterclockwise" = "clockwise",
): OfficeLayoutResult<OfficeLayoutDocument> {
  const current = layout.furniture[furnitureId];
  if (!current) {
    return failure("furniture-not-found", `Furniture "${furnitureId}" was not found.`);
  }

  const candidate: OfficeFurnitureInstance = {
    ...current,
    rotation: rotateOfficeRotation(current.rotation, direction),
  };

  const validation = validateFurniturePlacement(layout, candidate, furnitureId);
  if (!validation.ok) {
    return validation;
  }

  return success({
    ...layout,
    furniture: {
      ...layout.furniture,
      [furnitureId]: candidate,
    },
  });
}

function toggleOfficeFurnitureState(
  layout: OfficeLayoutDocument,
  furnitureId: OfficeFurnitureId,
  stateId = DEFAULT_TOGGLE_ID,
): OfficeLayoutResult<OfficeLayoutDocument> {
  const furniture = layout.furniture[furnitureId];
  if (!furniture) {
    return failure("furniture-not-found", `Furniture "${furnitureId}" was not found.`);
  }

  const current = furniture.toggles[stateId] ?? false;
  return success({
    ...layout,
    furniture: {
      ...layout.furniture,
      [furnitureId]: {
        ...furniture,
        toggles: {
          ...furniture.toggles,
          [stateId]: !current,
        },
      },
    },
  });
}

function removeOfficeFurniture(
  layout: OfficeLayoutDocument,
  furnitureId: OfficeFurnitureId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (!layout.furniture[furnitureId]) {
    return failure("furniture-not-found", `Furniture "${furnitureId}" was not found.`);
  }

  const idsToRemove = collectFurnitureDescendants(layout, furnitureId);
  const nextFurniture: OfficeLayoutDocument["furniture"] = {};

  for (const furniture of Object.values(layout.furniture)) {
    if (!idsToRemove.has(furniture.id)) {
      nextFurniture[furniture.id] = furniture;
    }
  }

  return success({
    ...layout,
    furniture: nextFurniture,
  });
}

export function placeOfficeCharacter(
  layout: OfficeLayoutDocument,
  character: OfficePlacedCharacter,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (layout.characters[character.id]) {
    return failure("duplicate-character", `Character "${character.id}" already exists.`);
  }

  const validation = validateCharacterPlacement(layout, character);
  if (!validation.ok) {
    return validation;
  }

  return success({
    ...layout,
    characters: {
      ...layout.characters,
      [character.id]: character,
    },
  });
}

function moveOfficeCharacter(
  layout: OfficeLayoutDocument,
  characterId: OfficeCharacterId,
  position: OfficeGridPosition,
): OfficeLayoutResult<OfficeLayoutDocument> {
  const current = layout.characters[characterId];
  if (!current) {
    return failure("character-not-found", `Character "${characterId}" was not found.`);
  }

  const candidate: OfficePlacedCharacter = {
    ...current,
    position,
  };

  const validation = validateCharacterPlacement(layout, candidate, characterId);
  if (!validation.ok) {
    return validation;
  }

  return success({
    ...layout,
    characters: {
      ...layout.characters,
      [characterId]: candidate,
    },
  });
}

function removeOfficeCharacter(
  layout: OfficeLayoutDocument,
  characterId: OfficeCharacterId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (!layout.characters[characterId]) {
    return failure("character-not-found", `Character "${characterId}" was not found.`);
  }

  const nextCharacters = { ...layout.characters };
  delete nextCharacters[characterId];

  return success({
    ...layout,
    characters: nextCharacters,
  });
}

function validateFurniturePlacement(
  layout: OfficeLayoutDocument,
  furniture: OfficeFurnitureInstance,
  ignoreFurnitureId?: OfficeFurnitureId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  switch (furniture.anchor.kind) {
    case "floor":
      return validateFloorFurniturePlacement(layout, furniture, ignoreFurnitureId);
    case "wall":
      return validateWallFurniturePlacement(layout, furniture, ignoreFurnitureId);
    case "surface":
      return validateSurfaceFurniturePlacement(layout, furniture, ignoreFurnitureId);
  }
}

function validateFloorFurniturePlacement(
  layout: OfficeLayoutDocument,
  furniture: OfficeFurnitureInstance,
  ignoreFurnitureId?: OfficeFurnitureId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (furniture.anchor.kind !== "floor" || !furniture.geometry.floor) {
    return failure("furniture-anchor-invalid", "Floor placement requires floor geometry.");
  }

  const anchor = furniture.anchor;
  const size = getFurnitureFloorSize(furniture);
  if (!size) {
    return failure("furniture-anchor-invalid", "Floor placement requires floor geometry.");
  }

  const origin = anchor.position;
  const maxX = origin.x + size.x;
  const maxY = origin.y + size.y;
  if (origin.x < 0 || origin.y < 0 || maxX > layout.grid.columns || maxY > layout.grid.rows) {
    return failure("furniture-position-out-of-bounds", "Furniture footprint is outside the office grid.");
  }

  const candidateTiles = getFurnitureFloorTiles(furniture);

  for (const existing of Object.values(layout.furniture)) {
    if (existing.id === ignoreFurnitureId || existing.anchor.kind !== "floor") {
      continue;
    }

    const overlaps = getFurnitureFloorTiles(existing).some((tile) =>
      candidateTiles.some((candidateTile) => candidateTile.x === tile.x && candidateTile.y === tile.y),
    );
    if (overlaps && (furniture.collision.blocksPlacement || existing.collision.blocksPlacement)) {
      return failure("furniture-placement-blocked", "Furniture collides with another floor item.");
    }
  }

  for (const character of Object.values(layout.characters)) {
    const occupied = candidateTiles.some(
      (tile) => tile.x === character.position.x && tile.y === character.position.y,
    );
    if (occupied && (furniture.collision.blocksPlacement || character.collision.blocksPlacement)) {
      return failure("furniture-placement-blocked", "Furniture footprint overlaps a character.");
    }
  }

  return success(layout);
}

function validateWallFurniturePlacement(
  layout: OfficeLayoutDocument,
  furniture: OfficeFurnitureInstance,
  ignoreFurnitureId?: OfficeFurnitureId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (furniture.anchor.kind !== "wall" || !furniture.geometry.wall) {
    return failure("furniture-anchor-invalid", "Wall placement requires wall geometry.");
  }

  const anchor = furniture.anchor;

  if (!isInBounds(layout, anchor.position)) {
    return failure("furniture-position-out-of-bounds", "Wall anchor is outside the office grid.");
  }

  const candidateInterval = getWallInterval(furniture);
  if (!candidateInterval) {
    return failure("furniture-anchor-invalid", "Wall placement requires a valid wall anchor.");
  }

  for (const existing of Object.values(layout.furniture)) {
    if (existing.id === ignoreFurnitureId || existing.anchor.kind !== "wall") {
      continue;
    }

    if (
      existing.anchor.position.x !== anchor.position.x ||
      existing.anchor.position.y !== anchor.position.y ||
      existing.anchor.wall !== anchor.wall
    ) {
      continue;
    }

    const existingInterval = getWallInterval(existing);
    if (
      existingInterval &&
      intervalsOverlap(candidateInterval, existingInterval) &&
      (furniture.collision.blocksPlacement || existing.collision.blocksPlacement)
    ) {
      return failure("furniture-placement-blocked", "Wall placement overlaps another wall-mounted item.");
    }
  }

  return success(layout);
}

function validateSurfaceFurniturePlacement(
  layout: OfficeLayoutDocument,
  furniture: OfficeFurnitureInstance,
  ignoreFurnitureId?: OfficeFurnitureId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (furniture.anchor.kind !== "surface" || !furniture.geometry.surface) {
    return failure("furniture-anchor-invalid", "Surface placement requires surface geometry.");
  }

  const anchor = furniture.anchor;
  const parent = layout.furniture[anchor.parentFurnitureId];
  if (!parent) {
    return failure("parent-furniture-not-found", "Surface placement parent furniture was not found.");
  }

  const surface = parent.geometry.surfaces?.find((entry) => entry.id === anchor.surfaceId);
  if (!surface) {
    return failure("surface-not-found", `Surface "${anchor.surfaceId}" was not found.`);
  }

  const candidateRect = getSurfacePlacementRect(furniture);
  if (!candidateRect) {
    return failure("furniture-anchor-invalid", "Surface placement requires a valid surface anchor.");
  }

  if (!rectContainsRect(getFurnitureSurfaceRect(parent, surface), candidateRect)) {
    return failure("surface-placement-blocked", "Furniture does not fit inside the target surface.");
  }

  for (const existing of Object.values(layout.furniture)) {
    if (existing.id === ignoreFurnitureId || existing.anchor.kind !== "surface") {
      continue;
    }

    if (
      existing.anchor.parentFurnitureId !== anchor.parentFurnitureId ||
      existing.anchor.surfaceId !== anchor.surfaceId
    ) {
      continue;
    }

    const existingRect = getSurfacePlacementRect(existing);
    if (
      existingRect &&
      rectsOverlap(candidateRect, existingRect) &&
      (furniture.collision.blocksPlacement || existing.collision.blocksPlacement)
    ) {
      return failure("surface-placement-blocked", "Furniture overlaps another item on the same surface.");
    }
  }

  return success(layout);
}

function validateCharacterPlacement(
  layout: OfficeLayoutDocument,
  character: OfficePlacedCharacter,
  ignoreCharacterId?: OfficeCharacterId,
): OfficeLayoutResult<OfficeLayoutDocument> {
  if (!isInBounds(layout, character.position)) {
    return failure("character-position-out-of-bounds", "Character is outside the office grid.");
  }

  for (const existing of Object.values(layout.characters)) {
    if (existing.id === ignoreCharacterId) {
      continue;
    }

    if (existing.position.x === character.position.x && existing.position.y === character.position.y) {
      return failure("character-position-blocked", "Character position is already occupied.");
    }
  }

  for (const furniture of Object.values(layout.furniture)) {
    if (furniture.anchor.kind !== "floor") {
      continue;
    }

    const occupied = getFurnitureFloorTiles(furniture).some(
      (tile) => tile.x === character.position.x && tile.y === character.position.y,
    );
    if (occupied && (furniture.collision.blocksMovement || furniture.collision.blocksPlacement)) {
      return failure("character-position-blocked", "Character cannot move onto blocking furniture.");
    }
  }

  return success(layout);
}

function collectFurnitureDescendants(
  layout: OfficeLayoutDocument,
  furnitureId: OfficeFurnitureId,
): Set<OfficeFurnitureId> {
  const pending = [furnitureId];
  const collected = new Set<OfficeFurnitureId>();

  while (pending.length > 0) {
    const nextId = pending.pop();
    if (!nextId || collected.has(nextId)) {
      continue;
    }

    collected.add(nextId);
    for (const furniture of Object.values(layout.furniture)) {
      if (furniture.anchor.kind === "surface" && furniture.anchor.parentFurnitureId === nextId) {
        pending.push(furniture.id);
      }
    }
  }

  return collected;
}

function translateFurniture(
  furniture: OfficeFurnitureInstance,
  left: number,
  top: number,
): OfficeFurnitureInstance {
  switch (furniture.anchor.kind) {
    case "floor":
      return {
        ...furniture,
        anchor: {
          ...furniture.anchor,
          position: {
            x: furniture.anchor.position.x + left,
            y: furniture.anchor.position.y + top,
          },
        },
      };
    case "wall":
      return {
        ...furniture,
        anchor: {
          ...furniture.anchor,
          position: {
            x: furniture.anchor.position.x + left,
            y: furniture.anchor.position.y + top,
          },
        },
      };
    case "surface":
      return furniture;
  }
}

function getTile(layout: OfficeLayoutDocument, position: OfficeGridPosition): OfficeTile | null {
  return layout.grid.tiles[toOfficeTileKey(position.x, position.y)] ?? null;
}

function isInBounds(layout: OfficeLayoutDocument, position: OfficeGridPosition): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < layout.grid.columns &&
    position.y < layout.grid.rows
  );
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}


function success<T>(value: T): OfficeLayoutResult<T> {
  return {
    ok: true,
    value,
  };
}

function failure<T>(code: OfficeErrorCode, message: string): OfficeLayoutResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}
