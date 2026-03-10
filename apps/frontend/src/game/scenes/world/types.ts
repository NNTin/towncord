import type Phaser from "phaser";
import type { InputDirection } from "../../assets/animationCatalog";
import type { EntityBehavior } from "../../domain/capabilities";
import type { EntityAction, EntityDefinition, EntityId } from "../../domain/model";

export type WorldPoint = {
  x: number;
  y: number;
};

export type EntityAutonomyState = {
  ambientActionIds: readonly string[];
  ambientCooldownMs: number;
  currentAmbientAction: string | null;
  currentAmbientMs: number;
  nextDecisionMs: number;
  wanderTarget: WorldPoint | null;
};

export type WorldEntity = {
  id: number;
  entityId: EntityId;
  definition: EntityDefinition;
  behavior: EntityBehavior;
  position: WorldPoint;
  velocity: WorldPoint;
  facing: InputDirection;
  state: EntityAction;
  animationAction: string;
  autonomy: EntityAutonomyState;
  sprite: Phaser.GameObjects.Sprite;
};
