import { useState } from "react";

type BottomToolbarProps = {
  isLayoutMode: boolean;
  onToggleLayoutMode: () => void;
  onResetLayout?: () => void;
  onSaveLayout?: () => void;
  canResetLayout?: boolean;
  canSaveLayout?: boolean;
  isLayoutDirty?: boolean;
  isSavingLayout?: boolean;
  layoutStatusText?: string | null;
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 10,
  right: 10,
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
  onResetLayout,
  onSaveLayout,
  canResetLayout = false,
  canSaveLayout = false,
  isLayoutDirty = false,
  isSavingLayout = false,
  layoutStatusText = null,
}: BottomToolbarProps): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);

  function resolveButtonStyle(
    key: string,
    options: {
      active?: boolean;
      disabled?: boolean;
    } = {},
  ): React.CSSProperties {
    const { active = false, disabled = false } = options;
    if (active) {
      return btnActive;
    }

    return {
      ...btnBase,
      background:
        hovered === key && !disabled
          ? "var(--pixel-btn-hover-bg)"
          : btnBase.background,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled
        ? "var(--pixel-btn-disabled-opacity)" as unknown as number
        : 1,
    };
  }

  return (
    <div style={panelStyle}>
      <button
        onClick={onToggleLayoutMode}
        onMouseEnter={() => setHovered("layout")}
        onMouseLeave={() => setHovered(null)}
        style={resolveButtonStyle("layout", { active: isLayoutMode })}
        title="Toggle layout editing mode"
      >
        Layout{isLayoutDirty ? "*" : ""}
      </button>

      {isLayoutMode ? (
        <>
          <button
            type="button"
            disabled={!canSaveLayout}
            onClick={onSaveLayout}
            onMouseEnter={() => setHovered("save")}
            onMouseLeave={() => setHovered(null)}
            style={resolveButtonStyle("save", { disabled: !canSaveLayout })}
            title="Save office layout JSON"
          >
            {isSavingLayout ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            disabled={!canResetLayout}
            onClick={onResetLayout}
            onMouseEnter={() => setHovered("reset")}
            onMouseLeave={() => setHovered(null)}
            style={resolveButtonStyle("reset", { disabled: !canResetLayout })}
            title="Reset unsaved office layout changes"
          >
            Reset
          </button>
          {layoutStatusText ? (
            <div
              style={{
                color: "var(--pixel-text)",
                fontFamily: "monospace",
                fontSize: 12,
                opacity: 0.8,
                paddingLeft: 2,
                whiteSpace: "nowrap",
              }}
            >
              {layoutStatusText}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
