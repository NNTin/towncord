import type { ContentRepository } from "../../contracts/contentInterfaces";
import type { OfficeSceneTile } from "../../officeLayoutContract";
import defaultLayoutDataJson from "public-assets-json:office/default-layout.json";
import { donargFurnitureCatalogData } from "./donargOfficeFurnitureCatalog";

export type DonargLayoutColor = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export type DonargLayoutPlacement = {
  uid: string;
  type: string;
  col: number;
  row: number;
};

export type DonargLayoutAnchorSource = {
  x: number;
  y: number;
};

export type DonargOfficeLayoutSource = {
  version: number;
  cols: number;
  rows: number;
  anchor?: DonargLayoutAnchorSource;
  tiles: Array<number | OfficeSceneTile>;
  tileColors?: Array<DonargLayoutColor | null>;
  furniture: DonargLayoutPlacement[];
};

export type DonargFurnitureAssetSource = {
  id: string;
  label?: string;
  category?: string;
  width?: number;
  height?: number;
  footprintW?: number;
  footprintH?: number;
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  groupId?: string;
  orientation?: string;
  state?: string;
};

export type DonargFurnitureCatalogSource = {
  assets: DonargFurnitureAssetSource[];
};

export type OfficeSceneContent = {
  sourceId: string;
  layout: DonargOfficeLayoutSource;
  furnitureCatalog: DonargFurnitureCatalogSource;
};

export interface OfficeSceneContentRepository extends ContentRepository<OfficeSceneContent> {}

const DEFAULT_OFFICE_SCENE_CONTENT: OfficeSceneContent = {
  sourceId: "public-assets:donarg-office",
  layout: defaultLayoutDataJson as DonargOfficeLayoutSource,
  furnitureCatalog: donargFurnitureCatalogData,
};

export function createStaticOfficeSceneContentRepository(
  content: OfficeSceneContent = DEFAULT_OFFICE_SCENE_CONTENT,
): OfficeSceneContentRepository {
  return {
    read() {
      return {
        sourceId: content.sourceId,
        layout: structuredClone(content.layout),
        furnitureCatalog: structuredClone(content.furnitureCatalog),
      };
    },
  };
}

export const officeSceneContentRepository = createStaticOfficeSceneContentRepository();
