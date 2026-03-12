import { type EquipmentId, TOOL_EQUIPMENT_MAP } from "./equipmentGroups";

export type EntityType = "player" | "mobs" | "props" | "tilesets";
export type TilesetFamily = "animated" | "static";
export type SpriteDirection = "up" | "down" | "side";
export type InputDirection = "up" | "down" | "left" | "right";

export type AnimationTrack = {
  id: string;
  label: string;
  entityType: EntityType;
  directional: boolean;
  keyByDirection: Partial<Record<SpriteDirection, string>>;
  undirectedKey: string | null;
  equipmentCompatible: EquipmentId[];
};

export type AnimationCatalog = {
  entityTypes: EntityType[];
  playerModels: string[];
  mobFamilies: string[];
  propFamilies: string[];
  tilesetFamilies: TilesetFamily[];
  /** key: path like "player/female", "mobs/animals/chicken", "props/animated/chest", "props/static/barrels", "tilesets/static/environment" */
  tracksByPath: Map<string, AnimationTrack[]>;
};

type MobCatalogDescriptor = {
  family: string;
  mobId: string;
  visualPath: string;
};

const SPRITE_DIRECTIONS: SpriteDirection[] = ["up", "down", "side"];
const TILESET_FAMILIES: TilesetFamily[] = ["animated", "static"];

function getSpriteDirection(segment: string): SpriteDirection | null {
  for (const dir of SPRITE_DIRECTIONS) {
    if (segment.endsWith(`-${dir}`)) return dir;
  }
  return null;
}

function getOrCreate(
  map: Map<string, AnimationTrack>,
  id: string,
  defaults: Omit<AnimationTrack, "id" | "directional" | "keyByDirection" | "undirectedKey">,
): AnimationTrack {
  if (!map.has(id)) {
    map.set(id, { id, ...defaults, directional: false, keyByDirection: {}, undirectedKey: null });
  }
  return map.get(id)!;
}

function parsePlayerKeys(
  keys: string[],
  pathTracks: Map<string, Map<string, AnimationTrack>>,
): void {
  const PREFIX = "characters.bloomseed.player.";
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const parts = key.split(".");
    // characters.bloomseed.player.<model>.<...groups>.<lastSegment>
    if (parts.length < 6) continue;
    const model = parts[3]!;
    const baseType = parts.slice(4, parts.length - 1).join("-");
    const lastSegment = parts[parts.length - 1]!;
    if (!baseType) continue;

    const path = `player/${model}`;
    if (!pathTracks.has(path)) pathTracks.set(path, new Map());
    const track = getOrCreate(pathTracks.get(path)!, baseType, {
      label: baseType,
      entityType: "player",
      equipmentCompatible: TOOL_EQUIPMENT_MAP[baseType] ?? [],
    });

    const dir = getSpriteDirection(lastSegment);
    if (dir) {
      track.directional = true;
      track.keyByDirection[dir] = key;
    } else {
      track.undirectedKey = key;
    }
  }
}

function parseMobKeys(
  keys: string[],
  pathTracks: Map<string, Map<string, AnimationTrack>>,
): void {
  const PREFIX = "mobs.bloomseed.";
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const parts = key.split(".");
    // mobs.bloomseed.<family>.<mobId>.<lastSegment>
    if (parts.length !== 5) continue;
    const family = parts[2]!;
    const mobId = parts[3]!;
    const lastSegment = parts[4]!;

    const mobPrefix = `${mobId}-`;
    const actionSegment = lastSegment.startsWith(mobPrefix)
      ? lastSegment.slice(mobPrefix.length)
      : lastSegment;
    const dir = getSpriteDirection(actionSegment);
    const actionId = dir ? actionSegment.slice(0, actionSegment.length - `-${dir}`.length) : actionSegment;

    const path = `mobs/${family}/${mobId}`;
    if (!pathTracks.has(path)) pathTracks.set(path, new Map());
    const track = getOrCreate(pathTracks.get(path)!, actionId, {
      label: actionId,
      entityType: "mobs",
      equipmentCompatible: [],
    });

    if (dir) {
      track.directional = true;
      track.keyByDirection[dir] = key;
    } else {
      track.undirectedKey = key;
    }
  }
}

function parsePropKeys(
  keys: string[],
  pathTracks: Map<string, Map<string, AnimationTrack>>,
): void {
  const PREFIX = "props.bloomseed.";
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const parts = key.split(".");
    if (parts.length < 4) continue;
    const family = parts[2];

    let path: string;
    let variantId: string;

    if (family === "static") {
      // New shape: props.bloomseed.static.<group>.<variant>
      // Legacy shape: props.bloomseed.static.<variant>
      if (parts.length === 5) {
        path = `props/static/${parts[3]!}`;
        variantId = parts[4]!;
      } else if (parts.length === 4) {
        path = "props/static";
        variantId = parts[3]!;
      } else {
        continue;
      }
    } else {
      // props.bloomseed.<family>.<group>.<variant>
      if (parts.length !== 5) continue;
      path = `props/${family}/${parts[3]!}`;
      variantId = parts[4]!;
    }

    if (!pathTracks.has(path)) pathTracks.set(path, new Map());
    const track = getOrCreate(pathTracks.get(path)!, variantId, {
      label: variantId,
      entityType: "props",
      equipmentCompatible: [],
    });
    track.undirectedKey = key;
  }
}

function parseTilesetKeys(
  keys: string[],
  pathTracks: Map<string, Map<string, AnimationTrack>>,
): void {
  const PREFIX = "tilesets.bloomseed.";
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const parts = key.split(".");
    // Current shape: tilesets.bloomseed.<group>.<tilesetType> (implicitly static)
    // Future shape: tilesets.bloomseed.<family>.<group>.<tilesetType>
    let family: TilesetFamily;
    let group: string;
    let tilesetType: string;

    if (parts.length === 4) {
      family = "static";
      group = parts[2]!;
      tilesetType = parts[3]!;
    } else if (parts.length === 5 && (parts[2] === "animated" || parts[2] === "static")) {
      family = parts[2];
      group = parts[3]!;
      tilesetType = parts[4]!;
    } else {
      continue;
    }

    const path = `tilesets/${family}/${group}`;

    if (!pathTracks.has(path)) pathTracks.set(path, new Map());
    const track = getOrCreate(pathTracks.get(path)!, tilesetType, {
      label: tilesetType,
      entityType: "tilesets",
      equipmentCompatible: [],
    });
    track.undirectedKey = key;
  }
}

export function buildAnimationCatalog(animationKeys: string[]): AnimationCatalog {
  const pathTracks = new Map<string, Map<string, AnimationTrack>>();
  parsePlayerKeys(animationKeys, pathTracks);
  parseMobKeys(animationKeys, pathTracks);
  parsePropKeys(animationKeys, pathTracks);
  parseTilesetKeys(animationKeys, pathTracks);

  const tracksByPath = new Map<string, AnimationTrack[]>();
  for (const [path, map] of pathTracks) {
    tracksByPath.set(path, [...map.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }

  const playerModels = new Set<string>();
  const mobFamilies = new Set<string>();
  const propFamilies = new Set<string>();
  const entityTypes = new Set<EntityType>();

  for (const path of tracksByPath.keys()) {
    const segments = path.split("/");
    const ns = segments[0];
    const sub = segments[1];
    if (ns === "player") {
      entityTypes.add("player");
      if (sub) playerModels.add(sub);
    } else if (ns === "mobs") {
      entityTypes.add("mobs");
      if (sub) mobFamilies.add(sub);
    } else if (ns === "props") {
      entityTypes.add("props");
      if (sub) propFamilies.add(sub);
    } else if (ns === "tilesets") {
      entityTypes.add("tilesets");
    }
  }

  return {
    entityTypes: [...entityTypes].sort() as EntityType[],
    playerModels: [...playerModels].sort(),
    mobFamilies: [...mobFamilies].sort(),
    propFamilies: [...propFamilies].sort(),
    tilesetFamilies: [...TILESET_FAMILIES],
    tracksByPath,
  };
}

export function resolveTrackForDirection(
  track: AnimationTrack,
  dir: InputDirection,
): { key: string; flipX: boolean } | null {
  const isHorizontal = dir === "left" || dir === "right";
  const flipX = dir === "left";
  const spriteDir: SpriteDirection = isHorizontal ? "side" : dir;

  if (track.directional) {
    const key = track.keyByDirection[spriteDir];
    if (key) return { key, flipX };
    // Fallback order: down → up → side
    const fallbackKey =
      track.keyByDirection["down"] ?? track.keyByDirection["up"] ?? track.keyByDirection["side"];
    if (fallbackKey) return { key: fallbackKey, flipX: false };
  }

  if (track.undirectedKey) return { key: track.undirectedKey, flipX: false };
  return null;
}

/** Returns mob IDs available under a given family. */
export function getMobIds(catalog: AnimationCatalog, family: string): string[] {
  const prefix = `mobs/${family}/`;
  return [...catalog.tracksByPath.keys()]
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length))
    .sort();
}

function parseMobVisualPath(path: string): MobCatalogDescriptor | null {
  const [ns, family, mobId, extra] = path.split("/");
  if (ns !== "mobs" || !family || !mobId || extra) return null;
  return { family, mobId, visualPath: path };
}

export function listMobDescriptors(catalog: AnimationCatalog): MobCatalogDescriptor[] {
  const descriptors: MobCatalogDescriptor[] = [];

  for (const path of catalog.tracksByPath.keys()) {
    const descriptor = parseMobVisualPath(path);
    if (descriptor) descriptors.push(descriptor);
  }

  return descriptors;
}

/** Returns prop groups under a prop family (e.g. "chest", "water", "barrels"). */
export function getPropGroups(catalog: AnimationCatalog, family: string): string[] {
  const prefix = `props/${family}/`;
  return [...catalog.tracksByPath.keys()]
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length))
    .sort();
}

/** Returns tileset groups under a tileset family (e.g. "environment", "structure"). */
export function getTilesetGroups(catalog: AnimationCatalog, family: TilesetFamily): string[] {
  const prefix = `tilesets/${family}/`;
  return [...catalog.tracksByPath.keys()]
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length))
    .sort();
}

/** Returns tracks for the given path, or [] if not found. */
export function getTracksForPath(catalog: AnimationCatalog, path: string): AnimationTrack[] {
  return catalog.tracksByPath.get(path) ?? [];
}
