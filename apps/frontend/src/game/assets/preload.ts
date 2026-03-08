import type Phaser from "phaser";

export const BLOOMSEED_PACK_KEY = "bloomseed";
export const BLOOMSEED_PACK_URL = "assets/bloomseed/pack.json";
export const BLOOMSEED_PACK_SECTION = "bloomseed";
export const BLOOMSEED_ANIMATIONS_JSON_KEY = "bloomseed.animations";
export const DEBUG_PACK_KEY = "debug";
export const DEBUG_PACK_URL = "assets/debug/pack.json";
export const DEBUG_PACK_SECTION = "debug";
export const DEBUG_ANIMATIONS_JSON_KEY = "debug.animations";

export type BloomseedPreloadOptions = {
  packKey?: string;
  packUrl?: string;
  section?: string;
  skipIfLoaded?: boolean;
};

/**
 * Queues the generated Bloomseed Phaser asset pack.
 * Call this in a Scene `preload()` method.
 */
export function preloadBloomseedPack(
  scene: Phaser.Scene,
  options: BloomseedPreloadOptions = {},
): boolean {
  const {
    packKey = BLOOMSEED_PACK_KEY,
    packUrl = BLOOMSEED_PACK_URL,
    section = BLOOMSEED_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  if (skipIfLoaded && scene.cache.json.exists(BLOOMSEED_ANIMATIONS_JSON_KEY)) {
    return false;
  }

  scene.load.pack(packKey, packUrl, section);
  return true;
}

export type DebugPreloadOptions = {
  packKey?: string;
  packUrl?: string;
  section?: string;
  skipIfLoaded?: boolean;
};

/**
 * Queues the generated debug Phaser asset pack.
 * Call this in a Scene `preload()` method.
 */
export function preloadDebugPack(
  scene: Phaser.Scene,
  options: DebugPreloadOptions = {},
): boolean {
  const {
    packKey = DEBUG_PACK_KEY,
    packUrl = DEBUG_PACK_URL,
    section = DEBUG_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  if (skipIfLoaded && scene.cache.json.exists(DEBUG_ANIMATIONS_JSON_KEY)) {
    return false;
  }

  scene.load.pack(packKey, packUrl, section);
  return true;
}
