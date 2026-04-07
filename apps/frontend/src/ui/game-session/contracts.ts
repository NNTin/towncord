import type { MouseEvent } from "react";
import type { AnimationCatalog } from "../../game/contracts/content";
import type { OfficeSelectedPlaceablePayload } from "../../game/contracts/office-editor";
import type {
  EntityPlaceableViewModel,
  PlaceableViewModel,
  RuntimePerfPayload,
  TerrainPlaceableViewModel,
  TerrainTileInspectedPayload,
} from "../../game/contracts/runtime";

export type RuntimeRootBindings = {
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
};

export type PlaceablesPanelViewModel = {
  placeables: PlaceableViewModel[];
  activeTerrainToolId: string | null;
  onSelectTerrainTool: (placeable: TerrainPlaceableViewModel) => void;
};

export type PlaceableGroupViewModel<TPlaceable extends PlaceableViewModel> = {
  key: string;
  label: string;
  placeables: TPlaceable[];
};

export type EntityToolbarViewModel = {
  groups: PlaceableGroupViewModel<EntityPlaceableViewModel>[];
  onClick: (placeable: EntityPlaceableViewModel) => void;
};

export type TerrainPropToolbarViewModel = {
  groups: PlaceableGroupViewModel<EntityPlaceableViewModel>[];
};

export type PropToolbarViewModel = TerrainPropToolbarViewModel;

export type SelectedOfficePlaceableViewModel =
  OfficeSelectedPlaceablePayload | null;

export type PreviewPanelViewModel = {
  catalog: AnimationCatalog;
  inspectedTile: TerrainTileInspectedPayload | null;
  onClearInspectedTile: () => void;
};

export type SidebarViewModel = {
  placeablesPanel: PlaceablesPanelViewModel;
  previewPanel: PreviewPanelViewModel;
  runtimeDiagnostics: RuntimePerfPayload | null;
};

export type ZoomControlsViewModel = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};
