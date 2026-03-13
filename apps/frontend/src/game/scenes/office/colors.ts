import Phaser from "phaser";
import type { OfficeSceneTileKind } from "./bootstrap";

const FLOOR_HUE = 0.48;
const FLOOR_SATURATION = 0.55;
const FLOOR_LIGHTNESS = 0.19;
const WALL_HUE = 0.61;
const WALL_SATURATION = 0.24;
const WALL_LIGHTNESS = 0.29;

export function resolveOfficeTileFill(kind: OfficeSceneTileKind, tint?: number): number {
  if (typeof tint === "number") {
    return tint;
  }

  if (kind === "floor") {
    return Phaser.Display.Color.HSLToColor(
      FLOOR_HUE,
      FLOOR_SATURATION,
      FLOOR_LIGHTNESS,
    ).color;
  }

  if (kind === "wall") {
    return Phaser.Display.Color.HSLToColor(
      WALL_HUE,
      WALL_SATURATION,
      WALL_LIGHTNESS,
    ).color;
  }

  return 0x020617;
}
