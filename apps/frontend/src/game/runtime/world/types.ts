import type Phaser from "phaser";
import type { InputDirection } from "../../content/asset-catalog/animationCatalog";
import type { FurnitureRotationQuarterTurns } from "../../contracts/content";
import type { EntityBehavior } from "../../world/entities/capabilities";
import type {
  EntityAction,
  EntityDefinition,
  EntityId,
} from "../../world/entities/model";
import type { WorldNavigationService } from "../../../engine/world-runtime/spatial";

export type WorldPoint = {
  x: number;
  y: number;
};

export type WorldTerrainPropPlacement = {
  anchorCell: {
    cellX: number;
    cellY: number;
  };
  footprintW: number;
  footprintH: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
};

export type EntityAutonomyState = {
  ambientActionIds: readonly string[];
  ambientCooldownMs: number;
  currentAmbientAction: string | null;
  currentAmbientMs: number;
  nextDecisionMs: number;
  path: WorldPoint[];
  pathIndex: number;
  pathRevision: number | null;
  wanderTarget: WorldPoint | null;
};

export type WorldActor = {
  id: number;
  entityId: EntityId;
  definition: EntityDefinition;
  behavior: EntityBehavior;
  position: WorldPoint;
  velocity: WorldPoint;
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
  facing: InputDirection;
  state: EntityAction;
  animationAction: string;
  autonomy: EntityAutonomyState;
  terrainPropPlacement?: WorldTerrainPropPlacement;
  /** Optional per-entity navigation override (e.g. barn.posts constraint for mobs). */
  navigation?: WorldNavigationService;
};

export interface WorldAnimationSprite {
  readonly flipX: boolean;
  play(key: string, ignoreIfPlaying?: boolean): unknown;
  setFlipX(value: boolean): unknown;
}

export interface WorldEntitySprite extends WorldAnimationSprite {
  readonly displayHeight: number;
  destroy(): unknown;
  setPosition(x: number, y: number): unknown;
}

export type WorldAutonomyActor = Pick<
  WorldActor,
  "animationAction" | "autonomy" | "behavior" | "position" | "state"
>;

export type WorldMovementActor = Pick<
  WorldActor,
  "behavior" | "facing" | "state" | "velocity"
>;

export type WorldAnimatedActor = Pick<
  WorldActor,
  "animationAction" | "definition" | "facing"
> & {
  sprite: WorldAnimationSprite;
};

export type WorldSelectableActor = Pick<WorldActor, "position"> & {
  sprite: Pick<WorldEntitySprite, "displayHeight">;
};

export type WorldEntity = WorldActor & {
  sprite: Phaser.GameObjects.Sprite;
};
