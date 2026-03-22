import type { DragEvent } from "react";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type {
  RuntimeDiagnostics,
  RuntimeTerrainInspection,
} from "./runtimeGateway";
import type {
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "./placeableService";

export type RuntimeRootBindings = {
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export type PlaceablesPanelViewModel = {
  placeables: PlaceableViewModel[];
  activeTerrainToolId: string | null;
  onDragStart: (event: DragEvent, placeable: PlaceableViewModel) => void;
  onSelectTerrainTool: (placeable: TerrainPlaceableViewModel) => void;
};

export type PreviewPanelViewModel = {
  catalog: AnimationCatalog;
  inspectedTile: RuntimeTerrainInspection | null;
  onClearInspectedTile: () => void;
};

export type SidebarViewModel = {
  placeablesPanel: PlaceablesPanelViewModel;
  previewPanel: PreviewPanelViewModel;
  runtimeDiagnostics: RuntimeDiagnostics | null;
};

export type ZoomControlsViewModel = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};
