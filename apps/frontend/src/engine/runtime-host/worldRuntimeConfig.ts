import Phaser from "phaser";

export function createWorldRuntimeConfig(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#111827",
    width: 1280,
    height: 720,
    scene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: {
        width: 320,
        height: 180,
      },
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
  };
}
