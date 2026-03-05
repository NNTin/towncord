import type Phaser from "phaser";
import type { InputDirection } from "../../assets/animationCatalog";
import type { EntityBehavior } from "../../domain/capabilities";
import type { EntityAction, EntityDefinition, EntityId } from "../../domain/model";

export type WorldEntity = {
  id: number;
  entityId: EntityId;
  definition: EntityDefinition;
  behavior: EntityBehavior;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  facing: InputDirection;
  state: EntityAction;
  sprite: Phaser.GameObjects.Sprite;
};
