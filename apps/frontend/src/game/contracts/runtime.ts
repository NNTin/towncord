import type { EntityId } from "../world/entities/model";
import type { TerrainBrushId, TerrainMaterialId } from "../terrain/contracts";
import type { AnimationCatalog } from "./content";
import type { FurnitureRotationQuarterTurns } from "./content";
import type { TerrainSeedDocument } from "../../data";
import type { TerrainContentSourceId } from "../content/asset-catalog/terrainContentRepository";

export type TerrainToolSelection = {
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  terrainSourceId?: TerrainContentSourceId;
} | null;

export type PlayerMovementState = "idle" | "walk" | "run";

export type RuntimeZoomState = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
};

export type ZoomChangedPayload = RuntimeZoomState;

export type PlayerPlacedPayload = {
  worldX: number;
  worldY: number;
};

export type PlayerStateChangedPayload = {
  state: PlayerMovementState;
};

export type SelectedTerrainToolPayload = TerrainToolSelection;

export type TerrainPropToolSelection = {
  propId: EntityId;
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
} | null;

export type SelectedTerrainPropToolPayload = TerrainPropToolSelection;

export type TerrainSelectedPropPayload = {
  kind: "prop";
  propId: EntityId;
  label: string;
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
  canRotate: boolean;
};

export type TerrainPropSelectionChangedPayload = {
  selection: TerrainSelectedPropPayload | null;
};

export type TerrainPropSelectionActionPayload = {
  action: "rotate" | "delete";
};

export type PlaceEntityDragPayload = {
  type: "entity";
  entityId: EntityId;
};

export type PlaceTerrainDragPayload = {
  type: "terrain";
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
};

export type PlaceDragPayload = PlaceEntityDragPayload | PlaceTerrainDragPayload;

export type PlaceEntityDropPayload = PlaceEntityDragPayload & {
  screenX: number;
  screenY: number;
};

export type PlaceTerrainDropPayload = PlaceTerrainDragPayload & {
  screenX: number;
  screenY: number;
};

export type PlaceDropPayload = PlaceEntityDropPayload | PlaceTerrainDropPayload;

export type EntityPlaceableViewModel = {
  id: string;
  type: "entity";
  entityId: EntityId;
  label: string;
  groupKey: string;
  groupLabel: string;
  /** First frame key of the idle-down animation in the bloomseed atlas, or null if unavailable. */
  previewFrameKey: string | null;
};

export type TerrainPlaceableViewModel = {
  id: string;
  type: "terrain";
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  terrainSourceId?: TerrainContentSourceId;
  label: string;
  groupKey: string;
  groupLabel: string;
};

export type PlaceableViewModel =
  | EntityPlaceableViewModel
  | TerrainPlaceableViewModel;

export type TerrainTileInspectedPayload = {
  textureKey: string;
  frame: string;
  cellX: number;
  cellY: number;
  materialId: TerrainMaterialId;
  caseId: number;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type TerrainSeedChangedPayload = {
  seed: TerrainSeedDocument;
};

export type RuntimePerfPayload = {
  timestampMs: number;
  fps: number;
  frameMs: number;
  updateMs: number;
  terrainMs: number;
};

export type RuntimeBootstrapPayload = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
};
