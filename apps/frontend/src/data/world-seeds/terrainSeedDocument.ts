export type TerrainSeedDocument = {
  width: number;
  height: number;
  chunkSize: number;
  defaultMaterial: string;
  materials: string[];
  legend: Record<string, string>;
  rows: string[];
};
