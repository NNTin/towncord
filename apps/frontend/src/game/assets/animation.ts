import type Phaser from "phaser";
import {
  isPublicAnimationManifest,
  parsePublicAnimationManifest,
  type PublicAnimationDefinition,
  type PublicAnimationManifest,
} from "@towncord/public-animation-contracts";
import { BLOOMSEED_ANIMATIONS_JSON_KEY } from "./preload";

export type BloomseedAnimationDefinition = PublicAnimationDefinition;
export type BloomseedAnimationManifest = PublicAnimationManifest;

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
  filter?: (animationId: string, definition: PublicAnimationDefinition) => boolean;
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

    const frames = buildAnimationFrames(definition);

    if (frames.length === 0) {
      continue;
    }

    const animationConfig: Phaser.Types.Animations.Animation = {
      key: animationKey,
      frames,
      repeat: override?.repeat ?? defaultRepeat,
      yoyo: override?.yoyo ?? false,
      delay: override?.delay ?? 0,
      repeatDelay: override?.repeatDelay ?? 0,
      showOnStart: override?.showOnStart ?? false,
      hideOnComplete: override?.hideOnComplete ?? false,
    };

    const frameRate = resolveAnimationFrameRate(definition, override?.frameRate, defaultFrameRate);
    if (frameRate !== undefined) {
      animationConfig.frameRate = frameRate;
    }

    scene.anims.create(animationConfig);

    created.push(animationKey);
  }

  return created;
}

export function buildAnimationFrames(
  definition: PublicAnimationDefinition,
): Phaser.Types.Animations.AnimationFrame[] {
  const durationsMs =
    Array.isArray(definition.durationsMs) &&
    definition.durationsMs.length === definition.frames.length &&
    definition.durationsMs.every((duration) => Number.isInteger(duration) && duration > 0)
      ? definition.durationsMs
      : null;

  return definition.frames.map((frame, index): Phaser.Types.Animations.AnimationFrame => {
    const animationFrame: Phaser.Types.Animations.AnimationFrame = {
      key: definition.atlasKey,
      frame,
    };

    if (durationsMs) {
      const duration = durationsMs[index];
      if (duration !== undefined) {
        animationFrame.duration = duration;
      }
    }

    return animationFrame;
  });
}

export function resolveAnimationFrameRate(
  definition: PublicAnimationDefinition,
  overrideFrameRate: number | undefined,
  defaultFrameRate: number,
): number | undefined {
  if (overrideFrameRate !== undefined) {
    return overrideFrameRate;
  }

  const hasDurations =
    Array.isArray(definition.durationsMs) &&
    definition.durationsMs.length === definition.frames.length &&
    definition.durationsMs.every((duration) => Number.isInteger(duration) && duration > 0);

  if (hasDurations) {
    return undefined;
  }

  return defaultFrameRate;
}

export function readAnimationManifest(
  scene: Phaser.Scene,
  manifestKey: string,
): PublicAnimationManifest {
  const raw = scene.cache.json.get(manifestKey) as unknown;

  return parsePublicAnimationManifest(raw);
}

export function readOptionalAnimationManifest(
  scene: Phaser.Scene,
  manifestKey: string,
): PublicAnimationManifest | null {
  const cache = (scene.cache as Phaser.Scene["cache"] | undefined)?.json;
  if (!cache || typeof cache.exists !== "function" || typeof cache.get !== "function") {
    return null;
  }

  if (!cache.exists(manifestKey)) {
    return null;
  }

  const raw = cache.get(manifestKey) as unknown;
  return isPublicAnimationManifest(raw) ? raw : null;
}

export function collectPhaseDurationsByAnimationId(
  manifest: PublicAnimationManifest | null,
): Record<string, number[]> {
  if (!manifest) {
    return {};
  }

  const phaseDurationsByAnimationId: Record<string, number[]> = {};
  for (const [animationId, definition] of Object.entries(manifest.animations)) {
    if (
      Array.isArray(definition.phaseDurationsMs) &&
      definition.phaseDurationsMs.length > 0 &&
      definition.phaseDurationsMs.every((duration) => Number.isInteger(duration) && duration > 0)
    ) {
      phaseDurationsByAnimationId[animationId] = [...definition.phaseDurationsMs];
    }
  }

  return phaseDurationsByAnimationId;
}
