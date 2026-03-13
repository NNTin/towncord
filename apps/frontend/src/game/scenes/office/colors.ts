import Phaser from "phaser";
import {
  OFFICE_TILE_TYPE,
  type OfficeFloorColor,
  type OfficeTileType,
} from "../../office";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHex(color: Phaser.Display.Color): number {
  return Number.parseInt(color.rgba.slice(1, 7), 16);
}

export function resolveOfficeTileFill(
  tile: OfficeTileType,
  tint?: OfficeFloorColor | null,
): number {
  if (tile === OFFICE_TILE_TYPE.VOID) {
    return 0x0f172a;
  }

  if (tile === OFFICE_TILE_TYPE.WALL) {
    return 0x475569;
  }

  if (tint) {
    const hue = clamp(tint.h / 360, 0, 1);
    const saturation = clamp(tint.s / 100, 0, 1);
    const lightness = clamp(0.52 + tint.b / 200, 0.12, 0.88);
    return toHex(Phaser.Display.Color.HSLToColor(hue, saturation, lightness));
  }

  switch (tile) {
    case OFFICE_TILE_TYPE.FLOOR_2:
      return 0x8db9c7;
    case OFFICE_TILE_TYPE.FLOOR_3:
      return 0x7c9a56;
    case OFFICE_TILE_TYPE.FLOOR_4:
      return 0x9b7a59;
    case OFFICE_TILE_TYPE.FLOOR_5:
      return 0x705d8f;
    case OFFICE_TILE_TYPE.FLOOR_6:
      return 0xb59f5a;
    case OFFICE_TILE_TYPE.FLOOR_7:
      return 0x7b4f8a;
    case OFFICE_TILE_TYPE.FLOOR_1:
    default:
      return 0xc7ae7a;
  }
}
