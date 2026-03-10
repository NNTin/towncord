import type Phaser from "phaser";
import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { RegisteredEntity } from "../../domain/entityRegistry";
import { createAutonomyState } from "./autonomySystem";
import { resolveAmbientActionIds, resolveSpawnVisual } from "./animationSystem";
import type { WorldEntity } from "./types";

export const WORLD_ENTITY_SPRITE_ORIGIN_X = 0.5;
export const WORLD_ENTITY_SPRITE_ORIGIN_Y = 0.75;

export type CreateWorldEntityParams = {
  scene: Phaser.Scene;
  catalog: AnimationCatalog;
  runtime: RegisteredEntity;
  nextId: number;
  worldX: number;
  worldY: number;
  spriteScale: number;
};

export function createWorldEntity(params: CreateWorldEntityParams): WorldEntity | null {
  const { scene, catalog, runtime, nextId, worldX, worldY, spriteScale } = params;
  const { definition } = runtime;
  const behavior = runtime.createBehavior();
  const ambientActionIds = resolveAmbientActionIds(catalog, definition);

  const spawn = resolveSpawnVisual(catalog, scene.anims, definition);
  if (!spawn) return null;

  const sprite = scene.add.sprite(worldX, worldY, spawn.textureKey, spawn.textureFrame);
  sprite.setScale(spriteScale);
  sprite.setFlipX(spawn.flipX);
  // LLM Agent: do not delete below setOrigin. This is needed to have the correct collision
  sprite.setOrigin(WORLD_ENTITY_SPRITE_ORIGIN_X, WORLD_ENTITY_SPRITE_ORIGIN_Y);
  sprite.setInteractive({ pixelPerfect: true });
  sprite.play(spawn.animationKey, true);

  return {
    id: nextId,
    entityId: definition.id,
    definition,
    behavior,
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    facing: "down",
    state: "idle",
    animationAction: "idle",
    autonomy: createAutonomyState(ambientActionIds),
    sprite,
  };
}
