import type Phaser from "phaser";
import type { AnimationCatalog } from "../../content/asset-catalog/animationCatalog";
import type { FurnitureRotationQuarterTurns } from "../../contracts/content";
import type { RegisteredEntity } from "../../world/entities/entityRegistry";
import { createAutonomyState } from "./autonomySystem";
import { resolveAmbientActionIds, resolveSpawnVisual } from "./animationSystem";
import type {
  WorldActor,
  WorldEntity,
  WorldTerrainPropPlacement,
} from "./types";

export const WORLD_ENTITY_SPRITE_ORIGIN_X = 0.5;
export const WORLD_ENTITY_SPRITE_ORIGIN_Y = 0.75;

type CreateWorldEntityParams = {
  scene: Phaser.Scene;
  catalog: AnimationCatalog;
  runtime: RegisteredEntity;
  nextId: number;
  worldX: number;
  worldY: number;
  spriteScale: number;
  rotationQuarterTurns?: FurnitureRotationQuarterTurns;
  terrainPropPlacement?: WorldTerrainPropPlacement;
};

type CreateWorldActorParams = Pick<
  CreateWorldEntityParams,
  | "catalog"
  | "nextId"
  | "runtime"
  | "worldX"
  | "worldY"
  | "rotationQuarterTurns"
>;

function createWorldActor(params: CreateWorldActorParams): WorldActor {
  const {
    catalog,
    runtime,
    nextId,
    worldX,
    worldY,
    rotationQuarterTurns = 0,
  } = params;
  const { definition } = runtime;
  const behavior = runtime.createBehavior();
  const ambientActionIds = resolveAmbientActionIds(catalog, definition);

  return {
    id: nextId,
    entityId: definition.id,
    definition,
    behavior,
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    rotationQuarterTurns,
    facing: "down",
    state: "idle",
    animationAction: "idle",
    autonomy: createAutonomyState(ambientActionIds, Math.random),
  };
}

export function createWorldEntity(
  params: CreateWorldEntityParams,
): WorldEntity | null {
  const {
    scene,
    catalog,
    runtime,
    nextId,
    worldX,
    worldY,
    spriteScale,
    terrainPropPlacement,
    rotationQuarterTurns = 0,
  } = params;
  const actor = createWorldActor({
    catalog,
    runtime,
    nextId,
    worldX,
    worldY,
    rotationQuarterTurns,
  });
  const { definition } = actor;

  const spawn = resolveSpawnVisual(catalog, scene.anims, definition);
  if (!spawn) return null;

  const sprite = scene.add.sprite(
    worldX,
    worldY,
    spawn.textureKey,
    spawn.textureFrame,
  );
  sprite.setScale(spriteScale);
  sprite.setFlipX(spawn.flipX);
  sprite.setRotation(actor.rotationQuarterTurns * (Math.PI / 2));
  // LLM Agent: do not delete below setOrigin. This is needed to have the correct collision
  sprite.setOrigin(WORLD_ENTITY_SPRITE_ORIGIN_X, WORLD_ENTITY_SPRITE_ORIGIN_Y);
  sprite.setInteractive({ pixelPerfect: true });
  sprite.play(spawn.animationKey, true);

  const nextActor: WorldEntity = {
    ...actor,
    ...(terrainPropPlacement && definition.kind === "prop"
      ? {
          terrainPropPlacement,
        }
      : {}),
    sprite,
  };

  return nextActor;
}
