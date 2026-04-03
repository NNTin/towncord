import charactersAtlasJson from "public-assets-json:farmrpg/atlases/characters.json";
import propsAtlasJson from "public-assets-json:farmrpg/atlases/props.json";

export type FarmrpgAtlasFrame = { x: number; y: number; w: number; h: number };

type FarmrpgAtlasData = {
  meta: { size: { w: number; h: number } };
  frames: Record<string, { frame: FarmrpgAtlasFrame }>;
};

export type FarmrpgAtlasFrameSource = {
  atlasImageUrl: string;
  atlasW: number;
  atlasH: number;
  frame: FarmrpgAtlasFrame;
};

type FarmrpgAtlasSource = {
  framePrefix: string;
  imageUrl: string;
  w: number;
  h: number;
  frames: Record<string, { frame: FarmrpgAtlasFrame }>;
};

function toAtlasSource(
  framePrefix: string,
  imageUrl: string,
  rawData: unknown,
): FarmrpgAtlasSource {
  const data = rawData as FarmrpgAtlasData;
  return {
    framePrefix,
    imageUrl,
    w: data.meta.size.w,
    h: data.meta.size.h,
    frames: data.frames,
  };
}

const FARMRPG_ATLAS_SOURCES: readonly FarmrpgAtlasSource[] = [
  toAtlasSource(
    "characters.farmrpg.",
    "/assets/farmrpg/atlases/characters.png",
    charactersAtlasJson,
  ),
  toAtlasSource(
    "props.farmrpg.",
    "/assets/farmrpg/atlases/props.png",
    propsAtlasJson,
  ),
];

export function resolveFarmrpgAtlasFrameSource(
  frameKey: string,
): FarmrpgAtlasFrameSource | null {
  for (const source of FARMRPG_ATLAS_SOURCES) {
    if (!frameKey.startsWith(source.framePrefix)) {
      continue;
    }

    const frame = source.frames[frameKey]?.frame;
    if (!frame) {
      return null;
    }

    return {
      atlasImageUrl: source.imageUrl,
      atlasW: source.w,
      atlasH: source.h,
      frame,
    };
  }

  return null;
}
