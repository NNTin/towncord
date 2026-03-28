import type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeFloorPickedPayload,
} from "../../../game/contracts/office-editor";
import type {
  FurnitureRotationQuarterTurns,
  OfficeColorAdjust,
  OfficeTileColor,
} from "../../../game/contracts/content";
import { useOfficeLayoutEditor } from "../../editors/office-layout/draft-state/useOfficeLayoutEditor";
import { useLayoutSaveState } from "./useLayoutSaveState";
import { useRuntimeUiBridge } from "./useRuntimeUiBridge";

type OfficeToolStateBridge = {
  activeTool: OfficeEditorToolId | null;
  activeFloorMode: OfficeFloorMode;
  activeTileColor: OfficeTileColor | null;
  activeFloorColor: OfficeColorAdjust;
  activeFloorPattern: string | null;
  activeFurnitureId: string | null;
  activeFurnitureRotationQuarterTurns: FurnitureRotationQuarterTurns;
  onSelectTool: (tool: OfficeEditorToolId | null) => void;
  onOfficeFloorPicked: (payload: OfficeFloorPickedPayload) => void;
};

type UseGameSessionOptions = {
  officeToolState: OfficeToolStateBridge;
};

export function useGameSession({ officeToolState }: UseGameSessionOptions) {
  const officeEditor = useOfficeLayoutEditor();
  const runtimeBridge = useRuntimeUiBridge({
    officeToolState: {
      activeTool: officeToolState.activeTool,
      activeFloorMode: officeToolState.activeFloorMode,
      activeTileColor: officeToolState.activeTileColor,
      activeFloorColor: officeToolState.activeFloorColor,
      activeFloorPattern: officeToolState.activeFloorPattern,
      activeFurnitureId: officeToolState.activeFurnitureId,
      activeFurnitureRotationQuarterTurns:
        officeToolState.activeFurnitureRotationQuarterTurns,
    },
    onOfficeLayoutChanged: officeEditor.syncFromRuntime,
    onOfficeFloorPicked: officeToolState.onOfficeFloorPicked,
    onClearOfficeTool() {
      officeToolState.onSelectTool(null);
    },
  });
  const layoutSaveState = useLayoutSaveState({
    officeEditor,
    terrainSeedSnapshot: runtimeBridge.terrainSeedSnapshot,
  });

  return {
    layoutSaveState,
    officeEditor,
    ...runtimeBridge,
  };
}
