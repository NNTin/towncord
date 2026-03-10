import { useState } from "react";
import type { AnimationCatalog } from "../game/assets/animationCatalog";
import type {
  PlaceableViewModel,
  TerrainPlaceableViewModel,
} from "../game/application/placeableService";
import type {
  RuntimePerfPayload,
  SelectedTerrainToolPayload,
  TerrainTileInspectedPayload,
} from "../game/events";
import { PLACE_DRAG_MIME, type PlaceDragPayload } from "../game/events";
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

  function handleDragStart(e: React.DragEvent, placeable: PlaceableViewModel): void {
    const payload: PlaceDragPayload =
      placeable.type === "entity"
        ? {
            type: "entity",
            entityId: placeable.entityId,
          }
        : {
            type: "terrain",
            materialId: placeable.materialId,
            brushId: placeable.brushId,
          };
    e.dataTransfer.setData(PLACE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleSelectTerrainTool(placeable: TerrainPlaceableViewModel): void {
    const currentTool = activeTerrainTool;
    if (
      currentTool &&
      currentTool.brushId === placeable.brushId &&
      currentTool.materialId === placeable.materialId
    ) {
      onSelectTerrainTool(null);
      return;
    }

    onSelectTerrainTool({
      materialId: placeable.materialId,
      brushId: placeable.brushId,
    });
  }

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
        onDragStart={handleDragStart}
        activeTerrainToolId={
          placeables.find((placeable) =>
            placeable.type === "terrain" &&
            activeTerrainTool?.brushId === placeable.brushId &&
            activeTerrainTool?.materialId === placeable.materialId
          )?.id ?? null
        }
        onSelectTerrainTool={handleSelectTerrainTool}
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
