export const OFFICE_POINTER_MOVED_EVENT = "officePointerMoved";
export const OFFICE_SELECTION_CHANGED_EVENT = "officeSelectionChanged";
export const OFFICE_CAMERA_CHANGED_EVENT = "officeCameraChanged";

export type OfficeSceneCellCoord = {
  col: number;
  row: number;
};

export type OfficeSceneHoverTarget =
  | {
      kind: "furniture";
      id: string;
      label: string;
    }
  | {
      kind: "character";
      id: string;
      label: string;
    }
  | null;

export type OfficePointerMovedPayload = {
  cell: OfficeSceneCellCoord | null;
  worldX: number;
  worldY: number;
  target: OfficeSceneHoverTarget;
};

export type OfficeSelectionChangedPayload = {
  cell: OfficeSceneCellCoord | null;
  target: OfficeSceneHoverTarget;
};

type OfficeCameraChangedPayload = {
  zoom: number;
  scrollX: number;
  scrollY: number;
};
