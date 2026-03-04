import type Phaser from "phaser";
import { BLOOMSEED_ANIMATIONS_JSON_KEY } from "./preload";

export type BloomseedAnimationDefinition = {
  atlasKey: string;
  frames: string[];
};

export type BloomseedAnimationManifest = {
  generatedAt?: string;
  namespace?: string;
  animations: Record<string, BloomseedAnimationDefinition>;
};

export type BloomseedAnimationOverride = {
  key?: string;
  frameRate?: number;
  repeat?: number;
  yoyo?: boolean;
  delay?: number;
  repeatDelay?: number;
  showOnStart?: boolean;
  hideOnComplete?: boolean;
};

export type RegisterBloomseedAnimationsOptions = {
  manifestKey?: string;
  defaultFrameRate?: number;
  defaultRepeat?: number;
  onMissingAtlas?: "skip" | "throw";
  filter?: (animationId: string, definition: BloomseedAnimationDefinition) => boolean;
  overrides?: Record<string, BloomseedAnimationOverride>;
};

/**
 * Registers animations from `assets/bloomseed/animations.json` in Phaser.
 * Returns animation keys that were created during this call.
 */
export function registerBloomseedAnimations(
  scene: Phaser.Scene,
  options: RegisterBloomseedAnimationsOptions = {},
): string[] {
  const {
    manifestKey = BLOOMSEED_ANIMATIONS_JSON_KEY,
    defaultFrameRate = 10,
    defaultRepeat = -1,
    onMissingAtlas = "skip",
    filter,
    overrides = {},
  } = options;

  const manifest = readAnimationManifest(scene, manifestKey);
  const created: string[] = [];

  for (const [animationId, definition] of Object.entries(manifest.animations)) {
    if (filter && !filter(animationId, definition)) {
      continue;
    }

    const override = overrides[animationId];
    const animationKey = override?.key ?? animationId;

    if (scene.anims.exists(animationKey)) {
      continue;
    }

    if (!scene.textures.exists(definition.atlasKey)) {
      if (onMissingAtlas === "throw") {
        throw new Error(
          `Bloomseed animation "${animationId}" references missing atlas "${definition.atlasKey}".`,
        );
      }
      continue;
    }

    const frameNames = definition.frames;
    if (frameNames.length === 0) {
      continue;
    }

    const frames = frameNames.map(
      (frame): Phaser.Types.Animations.AnimationFrame => ({
        key: definition.atlasKey,
        frame,
      }),
    );

    if (frames.length === 0) {
      continue;
    }

    scene.anims.create({
      key: animationKey,
      frames,
      frameRate: override?.frameRate ?? defaultFrameRate,
      repeat: override?.repeat ?? defaultRepeat,
      yoyo: override?.yoyo ?? false,
      delay: override?.delay ?? 0,
      repeatDelay: override?.repeatDelay ?? 0,
      showOnStart: override?.showOnStart ?? false,
      hideOnComplete: override?.hideOnComplete ?? false,
    });

    created.push(animationKey);
  }

  return created;
}

function readAnimationManifest(
  scene: Phaser.Scene,
  manifestKey: string,
): BloomseedAnimationManifest {
  const raw = scene.cache.json.get(manifestKey) as unknown;

  if (!isBloomseedAnimationManifest(raw)) {
    throw new Error(
      `Invalid Bloomseed animation manifest for cache key "${manifestKey}".`,
    );
  }

  return raw;
}

function isBloomseedAnimationManifest(
  value: unknown,
): value is BloomseedAnimationManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const objectValue = value as Record<string, unknown>;
  const animations = objectValue.animations;

  if (!animations || typeof animations !== "object") {
    return false;
  }

  for (const definition of Object.values(animations as Record<string, unknown>)) {
    if (!definition || typeof definition !== "object") {
      return false;
    }

    const item = definition as Record<string, unknown>;
    if (typeof item.atlasKey !== "string") {
      return false;
    }

    if (!Array.isArray(item.frames) || !item.frames.every((frame) => typeof frame === "string")) {
      return false;
    }
  }

  return true;
}
