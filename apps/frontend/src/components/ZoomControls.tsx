import { useState } from "react";
import type { ZoomControlsViewModel } from "../game/application/runtimeViewModels";

const btnBase: React.CSSProperties = {
  width: 40,
  height: 40,
  padding: 0,
  background: "var(--pixel-bg)",
  color: "var(--pixel-text)",
  border: "2px solid var(--pixel-border)",
  borderRadius: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "var(--pixel-shadow)",
  fontFamily: "monospace",
};

export function ZoomControls({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
}: ZoomControlsViewModel): JSX.Element {
  const [hovered, setHovered] = useState<"plus" | "minus" | null>(null);

  const minDisabled = zoom <= minZoom;
  const maxDisabled = zoom >= maxZoom;

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: "var(--pixel-controls-z)" as unknown as number,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        pointerEvents: "none",
      }}
    >
      <button
        onClick={onZoomIn}
        disabled={maxDisabled}
        onMouseEnter={() => setHovered("plus")}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...btnBase,
          background:
            hovered === "plus" && !maxDisabled
              ? "var(--pixel-btn-hover-bg)"
              : btnBase.background,
          cursor: maxDisabled ? "default" : "pointer",
          opacity: maxDisabled ? "var(--pixel-btn-disabled-opacity)" as unknown as number : 1,
          pointerEvents: "auto",
        }}
        title="Zoom in"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <line x1="9" y1="3" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={onZoomOut}
        disabled={minDisabled}
        onMouseEnter={() => setHovered("minus")}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...btnBase,
          background:
            hovered === "minus" && !minDisabled
              ? "var(--pixel-btn-hover-bg)"
              : btnBase.background,
          cursor: minDisabled ? "default" : "pointer",
          opacity: minDisabled ? "var(--pixel-btn-disabled-opacity)" as unknown as number : 1,
          pointerEvents: "auto",
        }}
        title="Zoom out"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
