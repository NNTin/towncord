import type { TerrainGameplayGrid } from "../../terrain";
import type { TerrainCellCoord } from "../../terrain/contracts";
import type { WorldPoint } from "./types";

export type NavigationSubject = {
  position: WorldPoint;
};

export type NavigationStep = {
  moveX: number;
  moveY: number;
  reached: boolean;
};

export interface WanderTargetPicker {
  pickWanderTarget(subject: NavigationSubject, rng: () => number): WorldPoint | null;
}

export interface MovementNavigator {
  getStepToward(subject: NavigationSubject, target: WorldPoint): NavigationStep;
}

export interface SpawnPositionResolver {
  resolveSpawnPoint(worldX: number, worldY: number): WorldPoint;
}

export interface WorldBoundsResolver {
  clampWorldPoint(worldX: number, worldY: number): WorldPoint;
}

export type WorldNavigationService =
  WanderTargetPicker &
  MovementNavigator &
  SpawnPositionResolver &
  WorldBoundsResolver;

const DEFAULT_WANDER_RADIUS_CELLS = 5;
const REACHED_DISTANCE = 8;
const WANDER_ATTEMPTS = 12;

export function createGameplayNavigationService(
  grid: TerrainGameplayGrid,
): WorldNavigationService {
  return {
    pickWanderTarget(subject, rng) {
      const startCell = grid.worldToCell(subject.position.x, subject.position.y);
      if (!startCell) return null;

      for (let attempt = 0; attempt < WANDER_ATTEMPTS; attempt += 1) {
        const targetCell = {
          cellX: startCell.cellX + randomOffset(rng, DEFAULT_WANDER_RADIUS_CELLS),
          cellY: startCell.cellY + randomOffset(rng, DEFAULT_WANDER_RADIUS_CELLS),
        };
        if (!grid.isCellWalkable(targetCell.cellX, targetCell.cellY)) continue;
        const path = grid.findPath(startCell, targetCell);
        if (!path || path.cells.length < 2) continue;
        const worldPoint = grid.cellToWorldCenter(targetCell.cellX, targetCell.cellY);
        if (worldPoint) return { x: worldPoint.worldX, y: worldPoint.worldY };
      }

      return null;
    },

    getStepToward(subject, target) {
      const startCell = grid.worldToCell(subject.position.x, subject.position.y);
      const targetCell = grid.worldToCell(target.x, target.y);
      if (!startCell || !targetCell) {
        return { moveX: 0, moveY: 0, reached: true };
      }

      const path = grid.findPath(startCell, targetCell);
      if (!path || path.cells.length <= 1) {
        return { moveX: 0, moveY: 0, reached: true };
      }

      const nextCell = path.cells[1]!;
      return buildStep(subject.position, grid, nextCell);
    },

    resolveSpawnPoint(worldX, worldY) {
      const clamped = grid.clampWorldPoint(worldX, worldY);
      const cell = grid.worldToCell(clamped.worldX, clamped.worldY);
      if (!cell) {
        return { x: clamped.worldX, y: clamped.worldY };
      }

      const walkableCell = grid.findNearestWalkableCell(cell);
      const worldPoint = walkableCell
        ? grid.cellToWorldCenter(walkableCell.cellX, walkableCell.cellY)
        : null;

      if (!worldPoint) {
        return { x: clamped.worldX, y: clamped.worldY };
      }

      return { x: worldPoint.worldX, y: worldPoint.worldY };
    },

    clampWorldPoint(worldX, worldY) {
      const point = grid.clampWorldPoint(worldX, worldY);
      return { x: point.worldX, y: point.worldY };
    },
  };
}

function randomOffset(rng: () => number, radius: number): number {
  return Math.round((rng() * 2 - 1) * radius);
}

function buildStep(
  position: WorldPoint,
  grid: TerrainGameplayGrid,
  targetCell: TerrainCellCoord,
): NavigationStep {
  const worldPoint = grid.cellToWorldCenter(targetCell.cellX, targetCell.cellY);
  if (!worldPoint) {
    return { moveX: 0, moveY: 0, reached: true };
  }

  const dx = worldPoint.worldX - position.x;
  const dy = worldPoint.worldY - position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= REACHED_DISTANCE) {
    return { moveX: 0, moveY: 0, reached: true };
  }

  return {
    moveX: dx / distance,
    moveY: dy / distance,
    reached: false,
  };
}
