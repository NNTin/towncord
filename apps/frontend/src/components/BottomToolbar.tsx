import { useState } from "react";
import { OFFICE_TILE_COLORS, type OfficeTileColor } from "../game/office/model";
import {
  ATLAS_H,
  ATLAS_IMAGE_URL,
  ATLAS_W,
  FURNITURE_PALETTE_CATEGORIES,
  FURNITURE_PALETTE_ITEMS,
  type FurniturePaletteItem,
} from "../game/office/officeFurniturePalette";

export type OfficeLayoutTool = "floor" | "wall" | "erase" | "furniture";

type BottomToolbarProps = {
  isLayoutMode: boolean;
  onToggleLayoutMode: () => void;
  isJsonEditorOpen?: boolean;
  onToggleJsonEditor?: () => void;
  activeTool?: OfficeLayoutTool | null;
  onSelectTool?: (tool: OfficeLayoutTool | null) => void;
  activeTileColor?: OfficeTileColor | null;
  onSelectTileColor?: (color: OfficeTileColor) => void;
  activeFurnitureId?: string | null;
  onSelectFurnitureId?: (id: string) => void;
  onResetLayout?: () => void;
  onSaveLayout?: () => void;
  canResetLayout?: boolean;
  canSaveLayout?: boolean;
  isLayoutDirty?: boolean;
  isSavingLayout?: boolean;
  layoutStatusText?: string | null;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const SCALE = 2;

const outerContainer: React.CSSProperties = {
  position: "absolute",
  bottom: 10,
  right: 10,
  zIndex: "var(--pixel-controls-z)" as unknown as number,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 4,
  pointerEvents: "auto",
};

const panelRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "var(--pixel-bg)",
  border: "2px solid var(--pixel-border)",
  padding: "4px 6px",
  boxShadow: "var(--pixel-shadow)",
};

const subPanel: React.CSSProperties = {
  background: "var(--pixel-bg)",
  border: "2px solid var(--pixel-border)",
  boxShadow: "var(--pixel-shadow)",
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxWidth: 320,
};

const btnBase: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "14px",
  fontFamily: "monospace",
  color: "var(--pixel-text)",
  background: "var(--pixel-btn-bg)",
  border: "2px solid transparent",
  cursor: "pointer",
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: "var(--pixel-active-bg)",
  border: "2px solid var(--pixel-accent)",
};

const divider: React.CSSProperties = {
  width: 1,
  background: "var(--pixel-border)",
  alignSelf: "stretch",
  margin: "2px 2px",
};

// ─── Tile color swatches ──────────────────────────────────────────────────────

const TILE_COLOR_CSS: Record<OfficeTileColor, string> = {
  neutral: "#475569",
  blue: "#2563eb",
  green: "#059669",
  yellow: "#d97706",
  orange: "#ea580c",
  red: "#dc2626",
  pink: "#db2777",
  purple: "#7c3aed",
};

// ─── Furniture sprite ─────────────────────────────────────────────────────────

function FurnitureSprite({ item }: { item: FurniturePaletteItem }): JSX.Element {
  const { x, y, w, h } = item.atlasFrame;
  return (
    <div
      style={{
        width: w * SCALE,
        height: h * SCALE,
        backgroundImage: `url('${ATLAS_IMAGE_URL}')`,
        backgroundPosition: `${-x * SCALE}px ${-y * SCALE}px`,
        backgroundSize: `${ATLAS_W * SCALE}px ${ATLAS_H * SCALE}px`,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function FloorSubPanel({
  activeTileColor,
  onSelectTileColor,
}: {
  activeTileColor: OfficeTileColor | null | undefined;
  onSelectTileColor: ((c: OfficeTileColor) => void) | undefined;
}): JSX.Element {
  return (
    <div style={subPanel}>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Tile Color
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {OFFICE_TILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onSelectTileColor?.(color)}
            style={{
              width: 24,
              height: 24,
              background: TILE_COLOR_CSS[color],
              border: activeTileColor === color ? "2px solid var(--pixel-accent)" : "2px solid var(--pixel-border)",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FurnitureSubPanel({
  activeFurnitureId,
  onSelectFurnitureId,
}: {
  activeFurnitureId: string | null | undefined;
  onSelectFurnitureId: ((id: string) => void) | undefined;
}): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string>(FURNITURE_PALETTE_CATEGORIES[0] ?? "desks");
  const items = FURNITURE_PALETTE_ITEMS.filter((i) => i.category === activeCategory);

  return (
    <div style={subPanel}>
      {/* Category tabs */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {FURNITURE_PALETTE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              ...btnBase,
              padding: "3px 7px",
              fontSize: 11,
              ...(activeCategory === cat ? { background: "var(--pixel-active-bg)", border: "2px solid var(--pixel-accent)" } : {}),
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sprite grid */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 4,
          alignItems: "flex-end",
          maxWidth: 304,
          minHeight: 68,
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onSelectFurnitureId?.(item.id)}
            style={{
              background: activeFurnitureId === item.id ? "var(--pixel-active-bg)" : "var(--pixel-btn-bg)",
              border: activeFurnitureId === item.id ? "2px solid var(--pixel-accent)" : "2px solid transparent",
              padding: 2,
              cursor: "pointer",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FurnitureSprite item={item} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LAYOUT_TOOLS: { key: OfficeLayoutTool; label: string }[] = [
  { key: "floor", label: "Floor" },
  { key: "wall", label: "Wall" },
  { key: "erase", label: "Erase" },
  { key: "furniture", label: "Furniture" },
];

export function BottomToolbar({
  isLayoutMode,
  onToggleLayoutMode,
  isJsonEditorOpen = false,
  onToggleJsonEditor,
  activeTool = null,
  onSelectTool,
  activeTileColor,
  onSelectTileColor,
  activeFurnitureId,
  onSelectFurnitureId,
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
    options: { active?: boolean; disabled?: boolean } = {},
  ): React.CSSProperties {
    const { active = false, disabled = false } = options;
    if (active) return btnActive;
    return {
      ...btnBase,
      background: hovered === key && !disabled ? "var(--pixel-btn-hover-bg)" : btnBase.background,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? ("var(--pixel-btn-disabled-opacity)" as unknown as number) : 1,
    };
  }

  function handleToolClick(tool: OfficeLayoutTool): void {
    onSelectTool?.(activeTool === tool ? null : tool);
  }

  return (
    <div style={outerContainer}>
      {/* Sub-panels (appear above button row) */}
      {isLayoutMode && activeTool === "floor" && (
        <FloorSubPanel activeTileColor={activeTileColor} onSelectTileColor={onSelectTileColor} />
      )}
      {isLayoutMode && activeTool === "furniture" && (
        <FurnitureSubPanel activeFurnitureId={activeFurnitureId} onSelectFurnitureId={onSelectFurnitureId} />
      )}

      {/* Button row */}
      <div style={panelRow}>
        <button
          onClick={onToggleLayoutMode}
          onMouseEnter={() => setHovered("layout")}
          onMouseLeave={() => setHovered(null)}
          style={resolveButtonStyle("layout", { active: isLayoutMode })}
          title="Toggle layout editing mode"
        >
          Layout{isLayoutDirty ? "*" : ""}
        </button>

        {isLayoutMode && (
          <>
            {LAYOUT_TOOLS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleToolClick(key)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                style={resolveButtonStyle(key, { active: activeTool === key })}
                title={`${label} tool`}
              >
                {label}
              </button>
            ))}

            <div style={divider} />

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
            <button
              type="button"
              onClick={onToggleJsonEditor}
              onMouseEnter={() => setHovered("json")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("json", { active: isJsonEditorOpen })}
              title="Toggle JSON editor"
            >
              JSON
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
        )}
      </div>
    </div>
  );
}
