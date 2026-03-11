import { useState } from "react";
import type { AnimationCatalog } from "../game/assets/animationCatalog";
import { createPlaceablesSidebarBridge } from "../game/application/placeablesSidebarBridge";
import type {
  PlaceableViewModel,
} from "../game/application/placeableService";
import type {
  RuntimePerfPayload,
  SelectedTerrainToolPayload,
  TerrainTileInspectedPayload,
} from "../game/events";
import type { PreviewInfo } from "./AnimationPreview";
import { AnimationInfoPanel } from "./sidebar/AnimationInfoPanel";
import { PlaceablesPanel } from "./sidebar/PlaceablesPanel";
import { PreviewPanel } from "./sidebar/PreviewPanel";
import { RuntimePerfPanel } from "./sidebar/RuntimePerfPanel";

type Props = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
  inspectedTile: TerrainTileInspectedPayload | null;
  onClearInspectedTile: () => void;
  activeTerrainTool: SelectedTerrainToolPayload;
  onSelectTerrainTool: (tool: SelectedTerrainToolPayload) => void;
  runtimePerf: RuntimePerfPayload | null;
};

export function SidebarAccordion({
  catalog,
  placeables,
  inspectedTile,
  onClearInspectedTile,
  activeTerrainTool,
  onSelectTerrainTool,
  runtimePerf,
}: Props): JSX.Element {
  const [animInfo, setAnimInfo] = useState<PreviewInfo | null>(null);
  const placeablesBridge = createPlaceablesSidebarBridge({
    placeables,
    activeTerrainTool,
    onSelectTerrainTool,
  });

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.9)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        gap: 4,
        height: "100%",
        left: 0,
        overflowY: "auto",
        padding: "8px 6px",
        position: "absolute",
        top: 0,
        width: 180,
        zIndex: 10,
      }}
    >
      <PlaceablesPanel
        placeables={placeables}
        onDragStart={placeablesBridge.onDragStart}
        activeTerrainToolId={placeablesBridge.activeTerrainToolId}
        onSelectTerrainTool={placeablesBridge.onSelectTerrainTool}
      />

      <PreviewPanel
        catalog={catalog}
        inspectedTile={inspectedTile}
        onClearInspectedTile={onClearInspectedTile}
        onInfo={setAnimInfo}
      />

      <AnimationInfoPanel animInfo={animInfo} />
      <RuntimePerfPanel perf={runtimePerf} />

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          color: "#475569",
          fontSize: 10,
          lineHeight: 1.7,
          marginTop: "auto",
          paddingTop: 8,
        }}
      >
        Drag entities to place
        <br />
        Click brush · Paint with left drag
        <br />
        WASD move · Shift run (player)
        <br />
        Click terrain tile to inspect when no brush is active
        <br />
        Mid-drag pan · Scroll zoom
      </div>
    </div>
  );
}
