import type Phaser from "phaser";
import type { AnimationCatalog } from "../../assets/animationCatalog";
import type { EntityDefinition } from "../../domain/model";
import { resolveSpawnVisual } from "./animationSystem";
import type { WorldEntity } from "./types";

export type CreateWorldEntityParams = {
  scene: Phaser.Scene;
  catalog: AnimationCatalog;
  definition: EntityDefinition;
  nextId: number;
  worldX: number;
  worldY: number;
  spriteScale: number;
};

export function createWorldEntity(params: CreateWorldEntityParams): WorldEntity | null {
  const { scene, catalog, definition, nextId, worldX, worldY, spriteScale } = params;

  const spawn = resolveSpawnVisual(catalog, scene.anims, definition);
  if (!spawn) return null;

  const sprite = scene.add.sprite(worldX, worldY, spawn.textureKey, spawn.textureFrame);
  sprite.setScale(spriteScale);
  sprite.setFlipX(spawn.flipX);
  sprite.play(spawn.animationKey, true);

  return {
    id: nextId,
    entityId: definition.id,
    definition,
    position: { x: worldX, y: worldY },
    velocity: { x: 0, y: 0 },
    facing: "down",
    state: "idle",
    sprite,
  };
}
