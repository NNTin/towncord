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

export type WorldNavigationService = WanderTargetPicker & MovementNavigator;

export type NavigationBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const DEFAULT_WANDER_RADIUS = 160;
const REACHED_DISTANCE = 8;

export function createFreeRoamNavigationService(
  bounds?: NavigationBounds,
): WorldNavigationService {
  return {
    pickWanderTarget(subject, rng) {
      const angle = rng() * Math.PI * 2;
      const distance = 48 + rng() * (DEFAULT_WANDER_RADIUS - 48);
      const target = {
        x: subject.position.x + Math.cos(angle) * distance,
        y: subject.position.y + Math.sin(angle) * distance,
      };

      if (!bounds) return target;

      return {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, target.x)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, target.y)),
      };
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
  };
}
