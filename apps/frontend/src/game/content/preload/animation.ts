import type Phaser from "phaser";
import {
  isPublicAnimationManifest,
  parsePublicAnimationManifest,
  type PublicAnimationDefinition,
  type PublicAnimationManifest,
} from "@towncord/public-animation-contracts";
import { listDonargOfficeCharacterAnimations } from "../asset-catalog/donargOfficeManifest";
import {
  BLOOMSEED_ANIMATIONS_JSON_KEY,
  DONARG_OFFICE_ANIMATIONS_JSON_KEY,
} from "./preload";

type PublicAnimationOverride = {
  key?: string;
  frameRate?: number;
  repeat?: number;
  yoyo?: boolean;
  delay?: number;
  repeatDelay?: number;
  showOnStart?: boolean;
  hideOnComplete?: boolean;
};

type RegisterPublicAnimationsOptions = {
  manifestKey: string;
  sourceLabel?: string;
  defaultRepeat?: number;
  onMissingAtlas?: "skip" | "throw";
  filter?: (animationId: string, definition: PublicAnimationDefinition) => boolean;
  overrides?: Record<string, PublicAnimationOverride>;
};

type RegisterNamedAnimationsOptions = Omit<
  RegisterPublicAnimationsOptions,
  "manifestKey" | "sourceLabel"
> & {
  manifestKey?: string;
};

type RegisterBloomseedAnimationsOptions = RegisterNamedAnimationsOptions;
type RegisterDonargOfficeAnimationsOptions = RegisterNamedAnimationsOptions;

type RegisterAnimationsFromManifestOptions = Omit<
  RegisterPublicAnimationsOptions,
  "manifestKey"
>;

type PreloadAnimationRegistration = {
  bloomseedAnimationKeys: string[];
  donargOfficeCharacterAnimationKeys: string[];
  animationKeys: string[];
};

/**
 * Registers animations from any public animations manifest loaded into Phaser's JSON cache.
 * Returns animation keys that were created during this call.
 */
function registerPublicAnimations(
  scene: Phaser.Scene,
  options: RegisterPublicAnimationsOptions,
): string[] {
  const {
    manifestKey,
    sourceLabel = "Public",
    defaultRepeat = -1,
    onMissingAtlas = "skip",
    filter,
    overrides = {},
  } = options;

  const manifest = readAnimationManifest(scene, manifestKey);
  return registerAnimationsFromManifest(scene, manifest, {
    sourceLabel,
    defaultRepeat,
    onMissingAtlas,
    ...(filter ? { filter } : {}),
    overrides,
  });
}

function registerAnimationsFromManifest(
  scene: Phaser.Scene,
  manifest: PublicAnimationManifest,
  options: RegisterAnimationsFromManifestOptions,
): string[] {
  const {
    sourceLabel = "Public",
    defaultRepeat = -1,
    onMissingAtlas = "skip",
    filter,
    overrides = {},
  } = options;
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
          `${sourceLabel} animation "${animationId}" references missing atlas "${definition.atlasKey}".`,
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

    const frameRate = resolveAnimationFrameRate(override?.frameRate);
    if (frameRate !== undefined) {
      animationConfig.frameRate = frameRate;
    }

    scene.anims.create(animationConfig);

    created.push(animationKey);
  }

  return created;
}

function buildPublicAnimationOptions(
  options: RegisterNamedAnimationsOptions,
  defaultManifestKey: string,
  sourceLabel: string,
): RegisterPublicAnimationsOptions {
  return {
    manifestKey: options.manifestKey ?? defaultManifestKey,
    sourceLabel,
    defaultRepeat: options.defaultRepeat ?? -1,
    onMissingAtlas: options.onMissingAtlas ?? "skip",
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.overrides ? { overrides: options.overrides } : {}),
  };
}

/**
 * Registers animations from `assets/bloomseed/animations.json` in Phaser.
 * Returns animation keys that were created during this call.
 */
export function registerBloomseedAnimations(
  scene: Phaser.Scene,
  options: RegisterBloomseedAnimationsOptions = {},
): string[] {
  return registerPublicAnimations(
    scene,
    buildPublicAnimationOptions(
      options,
      BLOOMSEED_ANIMATIONS_JSON_KEY,
      "Bloomseed",
    ),
  );
}

/**
 * Registers animations from `assets/donarg-office/animations.json` in Phaser.
 * Returns animation keys that were created during this call.
 */
export function registerDonargOfficeAnimations(
  scene: Phaser.Scene,
  options: RegisterDonargOfficeAnimationsOptions = {},
): string[] {
  return registerPublicAnimations(
    scene,
    buildPublicAnimationOptions(
      options,
      DONARG_OFFICE_ANIMATIONS_JSON_KEY,
      "Donarg office",
    ),
  );
}

/**
 * Registers only Donarg office character animations discovered from the public manifest.
 * Returns animation keys that were created during this call.
 */
function registerDonargOfficeCharacterAnimations(
  scene: Phaser.Scene,
  options: RegisterDonargOfficeAnimationsOptions = {},
): string[] {
  const manifestKey = options.manifestKey ?? DONARG_OFFICE_ANIMATIONS_JSON_KEY;
  const manifest = readAnimationManifest(scene, manifestKey);
  const characterAnimationIds = new Set(
    listDonargOfficeCharacterAnimations(manifest).map(
      (animation) => animation.animationId,
    ),
  );

  return registerAnimationsFromManifest(scene, manifest, {
    sourceLabel: "Donarg office",
    defaultRepeat: options.defaultRepeat ?? -1,
    onMissingAtlas: options.onMissingAtlas ?? "skip",
    filter: (animationId, definition) => {
      if (!characterAnimationIds.has(animationId)) {
        return false;
      }

      return options.filter ? options.filter(animationId, definition) : true;
    },
    ...(options.overrides ? { overrides: options.overrides } : {}),
  });
}

/**
 * Registers the animation set needed during frontend preload.
 * Bloomseed keys continue to drive the existing world bootstrap, while Donarg
 * office character animations are registered alongside them for later scenes.
 */
export function registerPreloadAnimations(
  scene: Phaser.Scene,
): PreloadAnimationRegistration {
  const bloomseedAnimationKeys = registerBloomseedAnimations(scene);
  const donargOfficeCharacterAnimationKeys = registerDonargOfficeCharacterAnimations(
    scene,
  );

  return {
    bloomseedAnimationKeys,
    donargOfficeCharacterAnimationKeys,
    animationKeys: [
      ...bloomseedAnimationKeys,
      ...donargOfficeCharacterAnimationKeys,
    ],
  };
}

function buildAnimationFrames(
  definition: PublicAnimationDefinition,
): Phaser.Types.Animations.AnimationFrame[] {
  if (
    definition.durationsMs.length !== definition.frames.length ||
    !definition.durationsMs.every((duration) => Number.isInteger(duration) && duration > 0)
  ) {
    const expectedDurations = definition.frames.length;
    const actualDurations = definition.durationsMs.length;
    const invalidDurationDetails: string[] = [];

    definition.durationsMs.forEach((duration, index) => {
      if (!Number.isInteger(duration) || duration <= 0) {
        invalidDurationDetails.push(`${index}:${String(duration)}`);
      }
    });

    const parts: string[] = [
      `Invalid animation durations for atlas "${definition.atlasKey}".`,
      `Expected ${expectedDurations} duration values for ${expectedDurations} frames,`,
      `but got ${actualDurations}.`,
    ];

    if (invalidDurationDetails.length > 0) {
      parts.push(
        `Invalid duration values at index:value -> [${invalidDurationDetails.join(", ")}].`,
      );
    }

    throw new Error(parts.join(" "));
  }

  return definition.frames.map((frame, index): Phaser.Types.Animations.AnimationFrame => {
    const animationFrame: Phaser.Types.Animations.AnimationFrame = {
      key: definition.atlasKey,
      frame,
    };

    const duration = definition.durationsMs[index];
    if (duration !== undefined) {
      animationFrame.duration = duration;
    }

    return animationFrame;
  });
}

function resolveAnimationFrameRate(
  overrideFrameRate: number | undefined,
): number | undefined {
  return overrideFrameRate;
}

function readAnimationManifest(
  scene: Phaser.Scene,
  manifestKey: string,
): PublicAnimationManifest {
  const raw = scene.cache.json.get(manifestKey) as unknown;

  try {
    return parsePublicAnimationManifest(raw);
  } catch (error) {
    const details = error instanceof Error && error.message ? ` ${error.message}` : "";
    throw new Error(`Invalid animation manifest for cache key "${manifestKey}".${details}`);
  }
}

export function readOptionalAnimationManifest(
  scene: Record<string, unknown>,
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