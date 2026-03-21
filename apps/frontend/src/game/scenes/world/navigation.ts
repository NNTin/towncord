import type { TerrainGameplayGrid } from "../../terrain";
import type { WorldPoint } from "./types";

type NavigationSubject = {
  position: WorldPoint;
};

type NavigationStep = {
  moveX: number;
  moveY: number;
  reached: boolean;
};

type NavigationPath = {
  waypoints: WorldPoint[];
  revision: number;
};

export interface WanderTargetPicker {
  pickWanderTarget(subject: NavigationSubject, rng: () => number): WorldPoint | null;
}

export interface MovementNavigator {
  getStepToward(subject: NavigationSubject, target: WorldPoint): NavigationStep;
}

export interface PathPlanner {
  planPath(subject: NavigationSubject, target: WorldPoint): NavigationPath | null;
  isPathValid(revision: number | null): boolean;
}

export interface CollisionMap {
  clampToBounds(point: WorldPoint): WorldPoint;
  isWalkable(point: WorldPoint): boolean;
}

export type AutonomyNavigationService =
  WanderTargetPicker &
  MovementNavigator &
  PathPlanner;

export type WorldNavigationService =
  AutonomyNavigationService &
  CollisionMap;

const DEFAULT_WANDER_RADIUS_CELLS = 5;
const REACHED_DISTANCE = 2;
const WANDER_ATTEMPTS = 16;

type WalkabilityOverride = {
  isWorldWalkable(worldX: number, worldY: number): boolean;
};

export function createTerrainNavigationService(
  grid: TerrainGameplayGrid,
  collisionOverride?: WalkabilityOverride,
): WorldNavigationService {
  return {
    pickWanderTarget(subject, rng) {
      const start = grid.worldToCell(subject.position.x, subject.position.y);
      if (!start || !grid.isCellWalkable(start.cellX, start.cellY)) return null;

      for (let attempt = 0; attempt < WANDER_ATTEMPTS; attempt += 1) {
        const offsetX = Math.floor(rng() * (DEFAULT_WANDER_RADIUS_CELLS * 2 + 1)) - DEFAULT_WANDER_RADIUS_CELLS;
        const offsetY = Math.floor(rng() * (DEFAULT_WANDER_RADIUS_CELLS * 2 + 1)) - DEFAULT_WANDER_RADIUS_CELLS;
        const goalX = start.cellX + offsetX;
        const goalY = start.cellY + offsetY;
        if (!grid.isCellWalkable(goalX, goalY)) continue;

        const worldTarget = grid.cellToWorldCenter(goalX, goalY);
        if (!worldTarget) continue;
        if (!grid.findPath(start, { cellX: goalX, cellY: goalY })) continue;

        return {
          x: worldTarget.worldX,
          y: worldTarget.worldY,
        };
      }

      return null;
    },

    getStepToward(subject, target) {
      const dx = target.x - subject.position.x;
      const dy = target.y - subject.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= REACHED_DISTANCE) {
        return { moveX: 0, moveY: 0, reached: true };
      }

      return {
        moveX: dx / distance,
        moveY: dy / distance,
        reached: false,
      };
    },

    planPath(subject, target) {
      const start = grid.worldToCell(subject.position.x, subject.position.y);
      const goal = grid.worldToCell(target.x, target.y);
      if (!start || !goal) return null;

      const path = grid.findPath(start, goal);
      if (!path) return null;

      const waypoints = path.cells
        .slice(1)
        .map((cell) => grid.cellToWorldCenter(cell.cellX, cell.cellY))
        .filter((point): point is { worldX: number; worldY: number } => point !== null)
        .map((point) => ({
          x: point.worldX,
          y: point.worldY,
        }));

      return {
        waypoints,
        revision: path.revision,
      };
    },

    isPathValid(revision) {
      return revision !== null && revision === grid.getRevision();
    },

    clampToBounds(point) {
      const clamped = grid.clampWorldPoint(point.x, point.y);
      return {
        x: clamped.worldX,
        y: clamped.worldY,
      };
    },

    isWalkable(point) {
      return collisionOverride
        ? collisionOverride.isWorldWalkable(point.x, point.y)
        : grid.isWorldWalkable(point.x, point.y);
    },
  };
}
