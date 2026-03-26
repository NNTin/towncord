import { describe, expect, test, vi } from "vitest";
import { createEntityVisualRef } from "../../../world/entities/model";
import {
  createWorldEntity,
  WORLD_ENTITY_SPRITE_ORIGIN_X,
  WORLD_ENTITY_SPRITE_ORIGIN_Y,
} from "../entityFactory";

vi.mock("../animationSystem", () => ({
  resolveAmbientActionIds: vi.fn(() => []),
  resolveSpawnVisual: vi.fn(() => ({
    animationKey: "entities.player.idle.down",
    flipX: false,
    textureKey: "debug.entities",
    textureFrame: "player-idle-0",
  })),
}));

describe("createWorldEntity", () => {
  test("anchors sprites to the collision-grid ground point", () => {
    const sprite = {
      setFlipX: vi.fn(),
      setInteractive: vi.fn(),
      setOrigin: vi.fn(),
      setScale: vi.fn(),
      play: vi.fn(),
    };
    const scene = {
      add: {
        sprite: vi.fn(() => sprite),
      },
      anims: {},
    };

    createWorldEntity({
      scene: scene as never,
      catalog: {} as never,
      runtime: {
        definition: {
          id: "player",
          label: "Player",
          kind: "player",
          visualRef: createEntityVisualRef("entities/player"),
          capabilities: ["idle", "walk"],
          placeable: true,
        },
        createBehavior: () => ({ movement: { walk: true } }) as never,
      },
      nextId: 1,
      worldX: 128,
      worldY: 192,
      spriteScale: 4,
    });

    expect(sprite.setOrigin).toHaveBeenCalledWith(
      WORLD_ENTITY_SPRITE_ORIGIN_X,
      WORLD_ENTITY_SPRITE_ORIGIN_Y,
    );
  });
});
