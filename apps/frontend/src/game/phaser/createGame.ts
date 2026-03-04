import Phaser from "phaser";
import { createPhaserConfig } from "./config";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game(createPhaserConfig(parent));
}
