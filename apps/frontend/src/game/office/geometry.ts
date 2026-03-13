import type {
  OfficeDirection,
  OfficeFloorFootprint,
  OfficeFurnitureAnchor,
  OfficeFurnitureInstance,
  OfficeFurnitureSurface,
  OfficeGridPosition,
  OfficePoint,
  OfficeRelativeTile,
  OfficeRotation,
  OfficeSurfaceFootprint,
  OfficeTileKey,
} from "./model";

const FULL_TILE_SPAN = 1;

type OfficeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function toOfficeTileKey(x: number, y: number): OfficeTileKey {
  return `${x},${y}`;
}

export function rotateOfficeRotation(
  rotation: OfficeRotation,
  direction: "clockwise" | "counterclockwise" = "clockwise",
): OfficeRotation {
  const rotations: OfficeRotation[] = [0, 90, 180, 270];
  const index = rotations.indexOf(rotation);
  const delta = direction === "clockwise" ? 1 : -1;
  const nextIndex = (index + delta + rotations.length) % rotations.length;

  return rotations[nextIndex] ?? rotation;
}

export function getWallPlacementOffset(wall: OfficeDirection, offset: number): OfficePoint {
  const clamped = clamp(offset, -0.5, 0.5);
  switch (wall) {
    case "north":
      return { x: clamped, y: -0.5 };
    case "east":
      return { x: 0.5, y: clamped };
    case "south":
      return { x: clamped, y: 0.5 };
    case "west":
      return { x: -0.5, y: clamped };
  }
}

export function getFurnitureFloorSize(furniture: OfficeFurnitureInstance): OfficePoint | null {
  const footprint = furniture.geometry.floor;
  if (!footprint) return null;

  if (furniture.rotation === 90 || furniture.rotation === 270) {
    return { x: footprint.height, y: footprint.width };
  }

  return { x: footprint.width, y: footprint.height };
}

function getFurnitureSurfaceSize(furniture: OfficeFurnitureInstance): OfficePoint | null {
  const footprint = furniture.geometry.surface;
  if (!footprint) return null;

  return getRotatedSize(footprint, furniture.rotation);
}

export function getFurnitureFloorTiles(furniture: OfficeFurnitureInstance): OfficeGridPosition[] {
  if (furniture.anchor.kind !== "floor" || !furniture.geometry.floor) {
    return [];
  }

  const anchor = furniture.anchor;
  const localTiles = getBlockedTiles(furniture.geometry.floor, furniture.rotation);
  return localTiles.map((tile) => ({
    x: anchor.position.x + tile.x,
    y: anchor.position.y + tile.y,
  }));
}

export function getFurnitureSurfaceRect(
  furniture: OfficeFurnitureInstance,
  surface: OfficeFurnitureSurface,
): OfficeRect {
  return {
    x: surface.x,
    y: surface.y,
    width: surface.width,
    height: surface.height,
  };
}

export function getSurfacePlacementRect(furniture: OfficeFurnitureInstance): OfficeRect | null {
  if (furniture.anchor.kind !== "surface" || !furniture.geometry.surface) {
    return null;
  }

  const anchor = furniture.anchor;
  const size = getRotatedSize(furniture.geometry.surface, furniture.rotation);
  return {
    x: anchor.x,
    y: anchor.y,
    width: size.x,
    height: size.y,
  };
}

function getAnchorTile(anchor: OfficeFurnitureAnchor): OfficeGridPosition | null {
  switch (anchor.kind) {
    case "floor":
    case "wall":
      return anchor.position;
    case "surface":
      return null;
  }
}

export function getWallInterval(furniture: OfficeFurnitureInstance): { start: number; end: number } | null {
  if (furniture.anchor.kind !== "wall") return null;

  const span = normalizeWallSpan(furniture.geometry.wall?.span ?? FULL_TILE_SPAN);
  const halfSpan = span / 2;
  const center = clamp(furniture.anchor.offset, -0.5 + halfSpan, 0.5 - halfSpan);

  return {
    start: center - halfSpan,
    end: center + halfSpan,
  };
}

export function rectsOverlap(a: OfficeRect, b: OfficeRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectContainsRect(container: OfficeRect, subject: OfficeRect): boolean {
  return (
    subject.x >= container.x &&
    subject.y >= container.y &&
    subject.x + subject.width <= container.x + container.width &&
    subject.y + subject.height <= container.y + container.height
  );
}

function getBlockedTiles(footprint: OfficeFloorFootprint, rotation: OfficeRotation): OfficeRelativeTile[] {
  const baseTiles =
    footprint.blockedTiles && footprint.blockedTiles.length > 0
      ? [...footprint.blockedTiles]
      : createFullFootprintTiles(footprint.width, footprint.height);

  return baseTiles.map((tile) => rotateRelativeTile(tile, footprint, rotation));
}

function createFullFootprintTiles(width: number, height: number): OfficeRelativeTile[] {
  const tiles: OfficeRelativeTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

function rotateRelativeTile(
  tile: OfficeRelativeTile,
  footprint: OfficeFloorFootprint,
  rotation: OfficeRotation,
): OfficeRelativeTile {
  switch (rotation) {
    case 0:
      return tile;
    case 90:
      return {
        x: footprint.height - 1 - tile.y,
        y: tile.x,
      };
    case 180:
      return {
        x: footprint.width - 1 - tile.x,
        y: footprint.height - 1 - tile.y,
      };
    case 270:
      return {
        x: tile.y,
        y: footprint.width - 1 - tile.x,
      };
  }
}

function getRotatedSize(
  footprint: OfficeSurfaceFootprint,
  rotation: OfficeRotation,
): OfficePoint {
  if (rotation === 90 || rotation === 270) {
    return { x: footprint.height, y: footprint.width };
  }

  return { x: footprint.width, y: footprint.height };
}

function normalizeWallSpan(span: number): number {
  return clamp(span, 0.05, FULL_TILE_SPAN);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
