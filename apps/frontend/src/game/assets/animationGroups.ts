const FEMALE_PREFIX = "characters.bloomseed.player.female.";

export type SpriteDirection = "up" | "down" | "side";
export type AnimationDirection = "up" | "down" | "left" | "right";

export type AnimationGroup = {
  baseType: string;
  hasDirections: boolean;
  directions: SpriteDirection[];
  keyMap: Partial<Record<SpriteDirection, string>>;
  undirectedKey: string | null;
  /** true when the sprite sheet's "side" frame faces left (flip logic is inverted) */
  sideNaturallyFacesLeft: boolean;
};

export type AnimationGroups = Map<string, AnimationGroup>;

const SPRITE_DIRECTIONS: SpriteDirection[] = ["up", "down", "side"];

function getSpriteDirection(lastSegment: string): SpriteDirection | null {
  for (const dir of SPRITE_DIRECTIONS) {
    if (lastSegment.endsWith(`-${dir}`)) return dir;
  }
  return null;
}

export function parseAnimationGroups(animationKeys: string[]): AnimationGroups {
  const groups: AnimationGroups = new Map();

  for (const key of animationKeys) {
    if (!key.startsWith(FEMALE_PREFIX)) continue;

    const parts = key.split(".");
    // parts[0..3] = "characters.bloomseed.player.female"
    // parts[4..n-2] = baseType segments (e.g. ["run"] or ["tool", "slash"])
    // parts[n-1] = last segment with optional direction suffix
    if (parts.length < 6) continue;
    const baseType = parts.slice(4, parts.length - 1).join("-");
    const lastSegment = parts[parts.length - 1];
    if (!baseType) continue;

    if (!groups.has(baseType)) {
      groups.set(baseType, {
        baseType,
        hasDirections: false,
        directions: [],
        keyMap: {},
        undirectedKey: null,
        sideNaturallyFacesLeft: baseType.startsWith("tool-"),
      });
    }

    const group = groups.get(baseType)!;
    const spriteDir = lastSegment ? getSpriteDirection(lastSegment) : null;

    if (spriteDir) {
      group.hasDirections = true;
      group.keyMap[spriteDir] = key;
      if (!group.directions.includes(spriteDir)) {
        group.directions.push(spriteDir);
      }
    } else {
      group.undirectedKey = key;
    }
  }

  return groups;
}

export function resolveAnimation(
  groups: AnimationGroups,
  baseType: string,
  direction: AnimationDirection,
): { key: string; flipX: boolean } | null {
  const group = groups.get(baseType);
  if (!group) return null;

  const isHorizontal = direction === "left" || direction === "right";
  const flipX = group.sideNaturallyFacesLeft ? direction === "right" : direction === "left";
  const spriteDir: SpriteDirection = isHorizontal ? "side" : direction;

  if (group.hasDirections) {
    const key = group.keyMap[spriteDir];
    if (key) return { key, flipX };
    // fallback to any available direction
    const fallbackKey = group.keyMap["down"] ?? group.keyMap["up"] ?? group.keyMap["side"];
    if (fallbackKey) return { key: fallbackKey, flipX: false };
  }

  if (group.undirectedKey) {
    return { key: group.undirectedKey, flipX: false };
  }

  return null;
}
