import { useState } from "react";
import type { AnimationCatalog } from "../game/assets/animationCatalog";
import type { PlaceableViewModel } from "../game/application/placeableService";
import { PLACE_DRAG_MIME, type PlaceDragPayload } from "../game/events";
import type { PreviewInfo } from "./AnimationPreview";
import { AnimationInfoPanel } from "./sidebar/AnimationInfoPanel";
import { PlaceablesPanel } from "./sidebar/PlaceablesPanel";
import { PreviewPanel } from "./sidebar/PreviewPanel";

type Props = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
};

export function SidebarAccordion({ catalog, placeables }: Props): JSX.Element {
  const [animInfo, setAnimInfo] = useState<PreviewInfo | null>(null);

  function handleDragStart(e: React.DragEvent, placeable: PlaceableViewModel): void {
    const payload: PlaceDragPayload = { entityId: placeable.entityId };
    e.dataTransfer.setData(PLACE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
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
      />

      <PreviewPanel catalog={catalog} onInfo={setAnimInfo} />

      <AnimationInfoPanel animInfo={animInfo} />

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
        Drag to place · Click to select
        <br />
        WASD move · Shift run (player)
        <br />
        Mid-drag pan · Scroll zoom
      </div>
    </div>
  );
}
