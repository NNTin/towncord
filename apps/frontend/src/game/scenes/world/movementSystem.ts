import { resolveNextAction } from "../../application/actionResolver";
import { hasCapability } from "../../domain/model";
import type { WorldEntity } from "./types";

const WALK_SPEED = 100;
const RUN_SPEED = 220;
/** Per-frame velocity retention at 60 fps when keys released (fast ease-out). */
const STOP_DAMPING_60FPS = 0.75;

export type MovementInput = {
  moveX: number;
  moveY: number;
  isRunModifier: boolean;
};

export function updateEntityMovement(
  entity: WorldEntity,
  dt: number,
  input: MovementInput,
): void {
  const isMoving = input.moveX !== 0 || input.moveY !== 0;

  if (hasCapability(entity.definition, "walk") && isMoving) {
    const len = Math.sqrt(input.moveX * input.moveX + input.moveY * input.moveY);
    const speed = input.isRunModifier && hasCapability(entity.definition, "run")
      ? RUN_SPEED
      : WALK_SPEED;
    entity.velocity.x = (input.moveX / len) * speed;
    entity.velocity.y = (input.moveY / len) * speed;

    if (Math.abs(input.moveX) >= Math.abs(input.moveY)) {
      entity.facing = input.moveX > 0 ? "right" : "left";
    } else {
      entity.facing = input.moveY > 0 ? "down" : "up";
    }
  } else {
    const dampFactor = Math.pow(STOP_DAMPING_60FPS, dt * 60);
    entity.velocity.x *= dampFactor;
    entity.velocity.y *= dampFactor;

    const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
    if (speed < 1 || !hasCapability(entity.definition, "walk")) {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
    }
  }

  entity.state = resolveNextAction(entity.definition, {
    isMoving,
    isRunModifier: input.isRunModifier,
  });
}
