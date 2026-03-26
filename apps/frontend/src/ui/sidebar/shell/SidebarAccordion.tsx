import { useState } from "react";
import type { SidebarViewModel } from "../../game-session/contracts";
import type { PreviewInfo } from "../preview/AnimationPreview";
import { RuntimePerfPanel } from "../diagnostics/RuntimePerfPanel";
import { PlaceablesPanel } from "../placeables/PlaceablesPanel";
import { AnimationInfoPanel } from "../preview/AnimationInfoPanel";
import { PreviewPanel } from "../preview/PreviewPanel";

type Props = {
  sidebar: SidebarViewModel;
};

export function SidebarAccordion({ sidebar }: Props): JSX.Element {
  const [animInfo, setAnimInfo] = useState<PreviewInfo | null>(null);

  return (
    <div
      style={{
        background: "var(--ui-sidebar-bg)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--ui-font-mono)",
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
          borderTop: "1px solid var(--ui-border-muted)",
          color: "var(--ui-text-disabled)",
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
