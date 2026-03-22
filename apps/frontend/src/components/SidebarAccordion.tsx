import { useState } from "react";
import type { SidebarViewModel } from "../game/application/runtimeViewModels";
import type { PreviewInfo } from "./AnimationPreview";
import { AnimationInfoPanel } from "./sidebar/AnimationInfoPanel";
import { PlaceablesPanel } from "./sidebar/PlaceablesPanel";
import { PreviewPanel } from "./sidebar/PreviewPanel";
import { RuntimePerfPanel } from "./sidebar/RuntimePerfPanel";

type Props = {
  sidebar: SidebarViewModel;
};

export function SidebarAccordion({ sidebar }: Props): JSX.Element {
  const [animInfo, setAnimInfo] = useState<PreviewInfo | null>(null);

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
      <PlaceablesPanel viewModel={sidebar.placeablesPanel} />

      <PreviewPanel preview={sidebar.previewPanel} onInfo={setAnimInfo} />

      <AnimationInfoPanel animInfo={animInfo} />
      <RuntimePerfPanel perf={sidebar.runtimeDiagnostics} />

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
