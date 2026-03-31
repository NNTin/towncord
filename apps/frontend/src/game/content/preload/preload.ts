import type Phaser from "phaser";

const BLOOMSEED_PACK_KEY = "bloomseed";
const BLOOMSEED_PACK_URL = "assets/bloomseed/pack.json";
const BLOOMSEED_PACK_SECTION = "bloomseed";
export const BLOOMSEED_ANIMATIONS_JSON_KEY = "bloomseed.animations";

const FARMRPG_PACK_KEY = "farmrpg";
const FARMRPG_PACK_URL = "assets/farmrpg/pack.json";
const FARMRPG_PACK_SECTION = "farmrpg";
export const FARMRPG_ANIMATIONS_JSON_KEY = "farmrpg.animations";

const DEBUG_PACK_KEY = "debug";
const DEBUG_PACK_URL = "assets/debug/pack.json";
const DEBUG_PACK_SECTION = "debug";
export const DEBUG_ANIMATIONS_JSON_KEY = "debug.animations";

const DONARG_OFFICE_PACK_KEY = "donarg-office";
const DONARG_OFFICE_PACK_URL = "assets/donarg-office/pack.json";
const DONARG_OFFICE_PACK_SECTION = "donarg-office";
export const DONARG_OFFICE_ANIMATIONS_JSON_KEY = "donarg-office.animations";

type PackPreloadOptions = {
  packKey?: string;
  packUrl?: string;
  section?: string;
  skipIfLoaded?: boolean;
};

function preloadPack(
  scene: Phaser.Scene,
  options: Required<PackPreloadOptions> & {
    manifestKey: string;
  },
): boolean {
  const { packKey, packUrl, section, skipIfLoaded, manifestKey } = options;

  if (skipIfLoaded && scene.cache.json.exists(manifestKey)) {
    return false;
  }

  scene.load.pack(packKey, packUrl, section);
  return true;
}

/**
 * Queues the generated Bloomseed Phaser asset pack.
 * Call this in a Scene `preload()` method.
 */
export function preloadBloomseedPack(
  scene: Phaser.Scene,
  options: PackPreloadOptions = {},
): boolean {
  const {
    packKey = BLOOMSEED_PACK_KEY,
    packUrl = BLOOMSEED_PACK_URL,
    section = BLOOMSEED_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  return preloadPack(scene, {
    packKey,
    packUrl,
    section,
    skipIfLoaded,
    manifestKey: BLOOMSEED_ANIMATIONS_JSON_KEY,
  });
}

export function preloadFarmrpgPack(
  scene: Phaser.Scene,
  options: PackPreloadOptions = {},
): boolean {
  const {
    packKey = FARMRPG_PACK_KEY,
    packUrl = FARMRPG_PACK_URL,
    section = FARMRPG_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  return preloadPack(scene, {
    packKey,
    packUrl,
    section,
    skipIfLoaded,
    manifestKey: FARMRPG_ANIMATIONS_JSON_KEY,
  });
}

/**
 * Queues the generated debug Phaser asset pack.
 * Call this in a Scene `preload()` method.
 */
export function preloadDebugPack(
  scene: Phaser.Scene,
  options: PackPreloadOptions = {},
): boolean {
  const {
    packKey = DEBUG_PACK_KEY,
    packUrl = DEBUG_PACK_URL,
    section = DEBUG_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  return preloadPack(scene, {
    packKey,
    packUrl,
    section,
    skipIfLoaded,
    manifestKey: DEBUG_ANIMATIONS_JSON_KEY,
  });
}

/**
 * Queues the generated Donarg office Phaser asset pack.
 * Call this in a Scene `preload()` method.
 */
export function preloadDonargOfficePack(
  scene: Phaser.Scene,
  options: PackPreloadOptions = {},
): boolean {
  const {
    packKey = DONARG_OFFICE_PACK_KEY,
    packUrl = DONARG_OFFICE_PACK_URL,
    section = DONARG_OFFICE_PACK_SECTION,
    skipIfLoaded = true,
  } = options;

  return preloadPack(scene, {
    packKey,
    packUrl,
    section,
    skipIfLoaded,
    manifestKey: DONARG_OFFICE_ANIMATIONS_JSON_KEY,
  });
}
