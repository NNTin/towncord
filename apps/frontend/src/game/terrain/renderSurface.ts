import type Phaser from "phaser";

/**
 * Narrow interface that exposes exactly the Phaser.Scene capabilities used by
 * TerrainRenderer and TerrainSystem. Accepting this interface instead of Phaser.Scene
 * decouples the terrain domain from the Phaser rendering API and allows unit tests to
 * supply a test double without standing up a full Phaser context.
 *
 * Phaser.Scene satisfies this interface via structural typing — no changes to
 * WorldScene are required.
 */
export interface TerrainRenderSurface {
  readonly textures: Phaser.Textures.TextureManager;
  readonly add: Pick<Phaser.GameObjects.GameObjectFactory, "renderTexture">;
  readonly make: Pick<Phaser.GameObjects.GameObjectCreator, "image">;
  readonly time: Pick<Phaser.Time.Clock, "now">;
  readonly cameras: Pick<Phaser.Cameras.Scene2D.CameraManager, "main">;
}
