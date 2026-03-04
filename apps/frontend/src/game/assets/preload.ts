import type Phaser from "phaser";

export const BLOOMSEED_PACK_KEY = "bloomseed";
export const BLOOMSEED_PACK_URL = "assets/bloomseed/pack.json";
export const BLOOMSEED_PACK_SECTION = "bloomseed";
export const BLOOMSEED_ANIMATIONS_JSON_KEY = "bloomseed.animations";

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
