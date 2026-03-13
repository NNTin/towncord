import type {
  PublicAnimationDefinition,
  PublicAnimationManifest,
} from "@towncord/public-animation-contracts";

export type DonargOfficeAnimationDirection = "up" | "down" | "side" | "right";

export type DonargOfficeCharacterAnimation = {
  animationId: string;
  atlasKey: string;
  palette: string;
  characterId: string;
  actionId: string;
  direction: DonargOfficeAnimationDirection | null;
};

const CHARACTER_SOURCE_PREFIX = "aseprite/characters/";
const ASEPRITE_SOURCE_SUFFIX = ".aseprite";
const DIRECTION_SUFFIXES: DonargOfficeAnimationDirection[] = [
  "up",
  "down",
  "side",
  "right",
];

export function listDonargOfficeCharacterAnimations(
  manifest: PublicAnimationManifest,
): DonargOfficeCharacterAnimation[] {
  const animations: DonargOfficeCharacterAnimation[] = [];

  for (const [animationId, definition] of Object.entries(manifest.animations)) {
    const normalized = normalizeDonargOfficeCharacterAnimation(animationId, definition);
    if (normalized) {
      animations.push(normalized);
    }
  }

  return animations.sort((left, right) => left.animationId.localeCompare(right.animationId));
}

export function normalizeDonargOfficeCharacterAnimation(
  animationId: string,
  definition: PublicAnimationDefinition,
): DonargOfficeCharacterAnimation | null {
  if (definition.category !== "characters") {
    return null;
  }

  const paletteFromId = parsePaletteFromAnimationId(animationId);
  if (!paletteFromId) {
    return null;
  }

  const characterId = parseCharacterIdFromSourceFile(definition.sourceFile);
  if (!characterId) {
    return null;
  }

  const actionSegment = parseActionSegment(animationId, paletteFromId, characterId);
  if (!actionSegment) {
    return null;
  }

  const direction = parseDirection(actionSegment);
  const actionId = direction
    ? actionSegment.slice(0, actionSegment.length - `-${direction}`.length)
    : actionSegment;

  if (!actionId) {
    return null;
  }

  return {
    animationId,
    atlasKey: definition.atlasKey,
    palette: definition.paletteVariant ?? paletteFromId,
    characterId,
    actionId,
    direction,
  };
}

function parsePaletteFromAnimationId(animationId: string): string | null {
  const segments = animationId.split(".");
  if (segments.length < 4 || segments[0] !== "characters") {
    return null;
  }

  const palette = segments[1];
  return palette && palette.length > 0 ? palette : null;
}

function parseCharacterIdFromSourceFile(sourceFile: string): string | null {
  if (
    !sourceFile.startsWith(CHARACTER_SOURCE_PREFIX) ||
    !sourceFile.endsWith(ASEPRITE_SOURCE_SUFFIX)
  ) {
    return null;
  }

  const relative = sourceFile.slice(
    CHARACTER_SOURCE_PREFIX.length,
    sourceFile.length - ASEPRITE_SOURCE_SUFFIX.length,
  );
  const segments = relative.split("/").filter(Boolean);
  const characterId = segments[segments.length - 1];
  return characterId && characterId.length > 0 ? characterId : null;
}

function parseActionSegment(
  animationId: string,
  palette: string,
  characterId: string,
): string | null {
  const prefix = `characters.${palette}.${characterId}.`;
  if (!animationId.startsWith(prefix)) {
    return null;
  }

  const actionSegment = animationId.slice(prefix.length);
  return actionSegment.length > 0 ? actionSegment : null;
}

function parseDirection(
  actionSegment: string,
): DonargOfficeAnimationDirection | null {
  for (const direction of DIRECTION_SUFFIXES) {
    if (actionSegment.endsWith(`-${direction}`)) {
      return direction;
    }
  }

  return null;
}
