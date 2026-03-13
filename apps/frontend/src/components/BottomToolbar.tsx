import { useState } from "react";

type BottomToolbarProps = {
  isLayoutMode: boolean;
  onToggleLayoutMode: () => void;
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 10,
  left: 10,
  zIndex: "var(--pixel-controls-z)" as unknown as number,
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "var(--pixel-bg)",
  border: "2px solid var(--pixel-border)",
  borderRadius: 0,
  padding: "4px 6px",
  boxShadow: "var(--pixel-shadow)",
  pointerEvents: "auto" as const,
};

const btnBase: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "14px",
  fontFamily: "monospace",
  color: "var(--pixel-text)",
  background: "var(--pixel-btn-bg)",
  border: "2px solid transparent",
  borderRadius: 0,
  cursor: "pointer",
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: "var(--pixel-active-bg)",
  border: "2px solid var(--pixel-accent)",
};

export function BottomToolbar({
  isLayoutMode,
  onToggleLayoutMode,
}: BottomToolbarProps): JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={panelStyle}>
      <button
        onClick={onToggleLayoutMode}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={
          isLayoutMode
            ? btnActive
            : {
                ...btnBase,
                background: hovered
                  ? "var(--pixel-btn-hover-bg)"
                  : btnBase.background,
              }
        }
        title="Toggle layout editing mode"
      >
        Layout
      </button>
    </div>
  );
}
