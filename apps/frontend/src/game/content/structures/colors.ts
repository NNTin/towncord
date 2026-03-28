import type { OfficeTileColor } from "../../world/structures/model";

export type OfficeColorAdjust = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export const DEFAULT_FLOOR_COLOR_ADJUST: OfficeColorAdjust = {
  h: 35,
  s: 30,
  b: 15,
  c: 0,
};

export const DEFAULT_WALL_COLOR_ADJUST: OfficeColorAdjust = {
  h: 214,
  s: 25,
  b: -54,
  c: 17,
};

export const OFFICE_TILE_COLOR_TINTS: Record<OfficeTileColor, number> = {
  neutral: 0x475569,
  blue: 0x2563eb,
  green: 0x059669,
  yellow: 0xd97706,
  orange: 0xea580c,
  red: 0xdc2626,
  pink: 0xdb2777,
  purple: 0x7c3aed,
};

const OFFICE_TILE_COLOR_ADJUSTS: Record<OfficeTileColor, OfficeColorAdjust> = {
  neutral: { h: 215, s: 19, b: -12, c: 0 },
  blue: { h: 221, s: 83, b: 78, c: 0 },
  green: { h: 161, s: 94, b: -31, c: 0 },
  yellow: { h: 32, s: 95, b: 32, c: 0 },
  orange: { h: 21, s: 90, b: 54, c: 0 },
  red: { h: 0, s: 72, b: 65, c: 0 },
  pink: { h: 333, s: 71, b: 65, c: 0 },
  purple: { h: 262, s: 83, b: 99, c: 0 },
};

function isOfficeTileColorPreset(value: string): value is OfficeTileColor {
  return Object.prototype.hasOwnProperty.call(OFFICE_TILE_COLOR_ADJUSTS, value);
}

export function cloneOfficeColorAdjust(color: OfficeColorAdjust): OfficeColorAdjust {
  return {
    h: color.h,
    s: color.s,
    b: color.b,
    c: color.c,
    ...(typeof color.colorize === "boolean" ? { colorize: color.colorize } : {}),
  };
}

export function isOfficeColorAdjust(value: unknown): value is OfficeColorAdjust {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    Number.isFinite(candidate.h) &&
    Number.isFinite(candidate.s) &&
    Number.isFinite(candidate.b) &&
    Number.isFinite(candidate.c) &&
    (!("colorize" in candidate) || typeof candidate.colorize === "boolean")
  );
}

export function officeColorAdjustEquals(
  left: OfficeColorAdjust | null | undefined,
  right: OfficeColorAdjust | null | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.h === right.h &&
    left.s === right.s &&
    left.b === right.b &&
    left.c === right.c &&
    !!left.colorize === !!right.colorize
  );
}

export function resolveOfficeTileColorAdjustPreset(
  tileColor: OfficeTileColor | string | null | undefined,
): OfficeColorAdjust {
  const key = typeof tileColor === "string" && isOfficeTileColorPreset(tileColor)
    ? tileColor
    : "neutral";
  return cloneOfficeColorAdjust(OFFICE_TILE_COLOR_ADJUSTS[key]);
}

export function resolveOfficeFloorAppearance(
  floorColor: OfficeColorAdjust | null | undefined,
  tileColor: OfficeTileColor | null | undefined,
  fallbackTint: number | null = null,
): { colorAdjust: OfficeColorAdjust; tint: number } {
  const neutralTint = OFFICE_TILE_COLOR_TINTS.neutral ?? 0x475569;

  if (floorColor) {
    const colorAdjust = cloneOfficeColorAdjust(floorColor);
    const tint = resolveOfficeTileTint(colorAdjust, fallbackTint ?? neutralTint) ?? neutralTint;
    return { colorAdjust, tint };
  }

  const colorAdjust = resolveOfficeTileColorAdjustPreset(tileColor);
  const tint = tileColor
    ? OFFICE_TILE_COLOR_TINTS[tileColor] ?? neutralTint
    : fallbackTint ?? neutralTint;

  return { colorAdjust, tint };
}

export function resolveOfficeWallAppearance(
  wallColor: OfficeColorAdjust | null | undefined,
  fallbackTint = 0x334155,
): { colorAdjust: OfficeColorAdjust; tint: number } {
  const colorAdjust = cloneOfficeColorAdjust(
    wallColor ?? DEFAULT_WALL_COLOR_ADJUST,
  );
  const tint = resolveOfficeTileTint(colorAdjust, fallbackTint) ?? fallbackTint;

  return { colorAdjust, tint };
}

export function findOfficeTileColorPreset(
  colorAdjust: OfficeColorAdjust | null | undefined,
): OfficeTileColor | null {
  if (!isOfficeColorAdjust(colorAdjust)) {
    return null;
  }

  for (const [preset, presetAdjust] of Object.entries(OFFICE_TILE_COLOR_ADJUSTS) as Array<
    [OfficeTileColor, OfficeColorAdjust]
  >) {
    if (officeColorAdjustEquals(colorAdjust, presetAdjust)) {
      return preset;
    }
  }

  return null;
}

export function resolveOfficeTileTint(
  colorAdjust: OfficeColorAdjust | null | undefined,
  fallbackTint: number | null = null,
): number | null {
  if (!isOfficeColorAdjust(colorAdjust)) {
    return fallbackTint;
  }

  const hue = ((colorAdjust.h % 360) + 360) % 360 / 360;
  const saturation = clamp01(colorAdjust.s / 100);
  const brightness = clamp01((colorAdjust.b + 100) / 200);
  const contrast = colorAdjust.c / 100;
  const lightness = clamp01(0.16 + brightness * 0.42 + contrast * 0.05);

  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return (channel << 16) | (channel << 8) | channel;
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const red = hueToRgb(p, q, hue + 1 / 3);
  const green = hueToRgb(p, q, hue);
  const blue = hueToRgb(p, q, hue - 1 / 3);

  return (
    (Math.round(red * 255) << 16) |
    (Math.round(green * 255) << 8) |
    Math.round(blue * 255)
  );
}

export function tintToHexCss(tint: number | null | undefined): string | null {
  if (typeof tint !== "number" || !Number.isFinite(tint)) {
    return null;
  }

  return `#${tint.toString(16).padStart(6, "0")}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hueToRgb(p: number, q: number, value: number): number {
  let channel = value;
  if (channel < 0) {
    channel += 1;
  }
  if (channel > 1) {
    channel -= 1;
  }
  if (channel < 1 / 6) {
    return p + (q - p) * 6 * channel;
  }
  if (channel < 1 / 2) {
    return q;
  }
  if (channel < 2 / 3) {
    return p + (q - p) * (2 / 3 - channel) * 6;
  }
  return p;
}
