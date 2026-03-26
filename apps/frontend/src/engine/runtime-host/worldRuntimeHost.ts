import Phaser from "phaser";
import { createWorldRuntimeConfig } from "./worldRuntimeConfig";

export function createWorldRuntimeHost(
  parent: HTMLElement,
  scene: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[],
): Phaser.Game {
  return new Phaser.Game(createWorldRuntimeConfig(parent, scene));
}
