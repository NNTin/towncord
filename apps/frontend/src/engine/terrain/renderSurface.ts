import type Phaser from "phaser";

export interface TerrainRenderSurface {
  readonly textures: Phaser.Textures.TextureManager;
  readonly add: Pick<Phaser.GameObjects.GameObjectFactory, "renderTexture">;
  readonly make: Pick<Phaser.GameObjects.GameObjectCreator, "image">;
  readonly time: Pick<Phaser.Time.Clock, "now">;
  readonly cameras: Pick<Phaser.Cameras.Scene2D.CameraManager, "main">;
}
