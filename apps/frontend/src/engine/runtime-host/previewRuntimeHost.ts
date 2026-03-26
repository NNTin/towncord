import Phaser from "phaser";

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

export function createPreviewRuntimeHost(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[],
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: "#0f172a",
    parent,
    scene,
    input: { keyboard: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    disableContextMenu: true,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      antialiasGL: false,
    },
  });
}
