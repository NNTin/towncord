import propsAtlasJson from "public-assets-json:farmrpg/atlases/props.json";

const FARMRPG_PROP_TEXTURE_KEY = "farmrpg.props";
const TILE_SIZE = 16;

type FarmrpgPropsAtlasData = {
  frames: Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
};

export type PropPaletteItem = {
  id: string;
  label: string;
  category: "props";
  textureKey: string;
  atlasKey: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
  footprintW: number;
  footprintH: number;
  placement: "floor";
  color: number;
  accentColor: number;
  groupLabel: string;
};

const propsAtlasData = propsAtlasJson as FarmrpgPropsAtlasData;

function titleCase(value: string): string {
  return value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveFrameKey(propId: string): string {
  const propPath = propId.replace(/^prop\./, "");
  return `props.farmrpg.${propPath}#0`;
}

function resolvePropLabel(propId: string): string {
  const parts = propId.split(".");
  return titleCase(parts[parts.length - 1] ?? propId);
}

function resolvePropGroupLabel(propId: string): string {
  const parts = propId.split(".");
  return titleCase(parts[2] ?? "props");
}

export function resolvePropPaletteItem(
  propId: string | null | undefined,
): PropPaletteItem | null {
  if (!propId) {
    return null;
  }

  const atlasKey = resolveFrameKey(propId);
  const atlasFrame = propsAtlasData.frames[atlasKey]?.frame;
  if (!atlasFrame) {
    return null;
  }

  return {
    id: propId,
    label: resolvePropLabel(propId),
    category: "props",
    textureKey: FARMRPG_PROP_TEXTURE_KEY,
    atlasKey,
    atlasFrame,
    footprintW: Math.max(1, Math.ceil(atlasFrame.w / TILE_SIZE)),
    footprintH: Math.max(1, Math.ceil(atlasFrame.h / TILE_SIZE)),
    placement: "floor",
    color: 0x65a30d,
    accentColor: 0xd9f99d,
    groupLabel: resolvePropGroupLabel(propId),
  };
}
