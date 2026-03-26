import furnitureCatalogDataJson from "public-assets-json:donarg-office/furniture-catalog.json";

export type DonargFurnitureCatalogAsset = {
  id: string;
  file: string;
  label: string;
  category: string;
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

export type DonargFurnitureCatalogData = {
  assets: DonargFurnitureCatalogAsset[];
};

export const donargFurnitureCatalogData =
  furnitureCatalogDataJson as DonargFurnitureCatalogData;