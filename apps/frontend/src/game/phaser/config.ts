import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { OfficeScene } from "../scenes/OfficeScene";
import { PreloadScene } from "../scenes/PreloadScene";
import { WorldScene } from "../scenes/WorldScene";

export function createPhaserConfig(
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#111827",
    width: 1280,
    height: 720,
    scene: [BootScene, PreloadScene, WorldScene, OfficeScene],
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
