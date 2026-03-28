import { useEffect, useState } from "react";
import {
  ATLAS_H,
  ATLAS_IMAGE_URL,
  ATLAS_W,
  DEFAULT_FLOOR_COLOR_ADJUST,
  DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  ENVIRONMENT_ATLAS_FRAMES,
  ENVIRONMENT_ATLAS_H,
  ENVIRONMENT_ATLAS_IMAGE_URL,
  ENVIRONMENT_ATLAS_W,
  DEBUG_TERRAIN_ATLAS_H,
  DEBUG_TERRAIN_ATLAS_IMAGE_URL,
  DEBUG_TERRAIN_ATLAS_W,
  FLOOR_PATTERN_ITEMS,
  FURNITURE_PALETTE_CATEGORIES,
  FURNITURE_PALETTE_ITEMS,
  OFFICE_TILE_COLORS,
  cloneOfficeColorAdjust,
  resolveOfficeFloorAppearance,
  TERRAIN_TOOLBAR_PREVIEW_ITEMS,
  tintToHexCss,
  type FurniturePaletteItem,
  type OfficeColorAdjust,
  type OfficeTileColor,
  type TerrainToolbarPreviewFrame,
  type TerrainToolbarPreviewItem,
} from "../../../game/contracts/content";
import type { OfficeFloorMode } from "../../../game/contracts/office-editor";
import type { TerrainToolSelection } from "../../../game/contracts/runtime";
import type { EntityToolbarViewModel } from "../../game-session/contracts";

export type OfficeLayoutTool = "floor" | "wall" | "erase" | "furniture";

type LayoutModeProps = {
  isLayoutMode: boolean;
  onToggleLayoutMode: () => void;
};

type ToolSelectionProps = {
  isJsonEditorOpen?: boolean;
  onToggleJsonEditor?: () => void;
  entityToolbarViewModel?: EntityToolbarViewModel | null;
  activeTool?: OfficeLayoutTool | null;
  onSelectTool?: (tool: OfficeLayoutTool | null) => void;
  activeFloorMode?: OfficeFloorMode | null;
  onSelectFloorMode?: (mode: OfficeFloorMode) => void;
  activeTileColor?: OfficeTileColor | null;
  onSelectTileColor?: (color: OfficeTileColor) => void;
  activeFloorColor?: OfficeColorAdjust | null;
  onSelectFloorColor?: (color: OfficeColorAdjust) => void;
  activeFloorPattern?: string | null;
  onSelectFloorPattern?: (id: string) => void;
  activeFurnitureId?: string | null;
  onSelectFurnitureId?: (id: string) => void;
  activeTerrainTool?: TerrainToolSelection;
  onSelectTerrainTool?: (tool: TerrainToolSelection) => void;
};

type PersistenceProps = {
  onResetLayout?: () => void;
  onSaveLayout?: () => void;
  canResetLayout?: boolean;
  canSaveLayout?: boolean;
  isLayoutDirty?: boolean;
  isTerrainDirty?: boolean;
  isSavingLayout?: boolean;
  layoutStatusText?: string | null;
};

type BottomToolbarProps = LayoutModeProps & ToolSelectionProps & PersistenceProps;

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

// ─── Furniture sprite ─────────────────────────────────────────────────────────

type AtlasFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function AtlasSprite({
  atlasUrl,
  atlasW,
  atlasH,
  frame,
  scale = SCALE,
}: {
  atlasUrl: string;
  atlasW: number;
  atlasH: number;
  frame: AtlasFrame;
  scale?: number;
}): JSX.Element {
  return (
    <div
      style={{
        width: frame.w * scale,
        height: frame.h * scale,
        backgroundImage: `url('${atlasUrl}')`,
        backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
        backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}

function FurnitureSprite({ item }: { item: FurniturePaletteItem }): JSX.Element {
  return (
    <AtlasSprite
      atlasUrl={ATLAS_IMAGE_URL}
      atlasW={ATLAS_W}
      atlasH={ATLAS_H}
      frame={item.atlasFrame}
    />
  );
}

function EnvironmentAtlasSprite({ frame }: { frame: AtlasFrame }): JSX.Element {
  return (
    <AtlasSprite
      atlasUrl={ENVIRONMENT_ATLAS_IMAGE_URL}
      atlasW={ENVIRONMENT_ATLAS_W}
      atlasH={ENVIRONMENT_ATLAS_H}
      frame={frame}
    />
  );
}

function TerrainAtlasSprite({ frame }: { frame: TerrainToolbarPreviewFrame }): JSX.Element {
  return (
    <AtlasSprite
      atlasUrl={DEBUG_TERRAIN_ATLAS_IMAGE_URL}
      atlasW={DEBUG_TERRAIN_ATLAS_W}
      atlasH={DEBUG_TERRAIN_ATLAS_H}
      frame={frame.atlasFrame}
    />
  );
}

function TintedAtlasSprite({
  frame,
  tint,
}: {
  frame: AtlasFrame;
  tint: number | null | undefined;
}): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        width: frame.w * SCALE,
        height: frame.h * SCALE,
        overflow: "hidden",
        flexShrink: 0,
        isolation: "isolate",
      }}
    >
      <EnvironmentAtlasSprite frame={frame} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tintToHexCss(tint) ?? "transparent",
          opacity: 0.45,
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

function TerrainPreviewSprite({
  item,
  tick,
}: {
  item: TerrainToolbarPreviewItem;
  tick: number;
}): JSX.Element {
  const phaseIndex =
    item.animationFrames.length > 1
      ? tick % item.animationFrames.length
      : 0;
  const frame = item.animationFrames[phaseIndex] ?? item.representativeFrame;
  return <TerrainAtlasSprite frame={frame} />;
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function ColorSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", width: 14 }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ flex: 1, accentColor: "var(--pixel-accent)" }}
      />
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", width: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function FloorTilePreview({ colorAdjust }: { colorAdjust: OfficeColorAdjust }): JSX.Element {
  const defaultFrame = ENVIRONMENT_ATLAS_FRAMES["environment.floors.pattern-01#0"];
  const { tint } = resolveOfficeFloorAppearance(colorAdjust, null);
  if (!defaultFrame) {
    return (
      <div
        style={{
          width: 32,
          height: 32,
          background: tintToHexCss(tint) ?? "var(--pixel-btn-bg)",
        }}
      />
    );
  }
  return <TintedAtlasSprite frame={defaultFrame.frame} tint={tint} />;
}

function FloorPatternPreview({
  patternId,
  atlasFrame,
  colorAdjust,
  selected,
  onClick,
}: {
  patternId: string;
  atlasFrame?: { x: number; y: number; w: number; h: number };
  colorAdjust: OfficeColorAdjust;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  const frame = atlasFrame ?? ENVIRONMENT_ATLAS_FRAMES["environment.floors.pattern-01#0"]?.frame;
  if (!frame) {
    return <button type="button" onClick={onClick} style={selected ? btnActive : btnBase}>{patternId}</button>;
  }

  const { tint } = resolveOfficeFloorAppearance(colorAdjust, null);
  return (
    <button
      type="button"
      title={patternId}
      onClick={onClick}
      style={{
        padding: 2,
        background: selected ? "var(--pixel-active-bg)" : "var(--pixel-btn-bg)",
        border: selected ? "2px solid var(--pixel-accent)" : "2px solid transparent",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <TintedAtlasSprite frame={frame} tint={tint} />
    </button>
  );
}

function FloorSubPanel({
  activeFloorMode,
  activeTileColor,
  onSelectTileColor,
  activeFloorColor,
  onSelectFloorColor,
  activeFloorPattern,
  onSelectFloorPattern,
  onSelectFloorMode,
}: {
  activeFloorMode: OfficeFloorMode | null | undefined;
  activeTileColor: OfficeTileColor | null | undefined;
  onSelectTileColor: ((c: OfficeTileColor) => void) | undefined;
  activeFloorColor: OfficeColorAdjust | null | undefined;
  onSelectFloorColor: ((color: OfficeColorAdjust) => void) | undefined;
  activeFloorPattern: string | null | undefined;
  onSelectFloorPattern: ((id: string) => void) | undefined;
  onSelectFloorMode: ((mode: OfficeFloorMode) => void) | undefined;
}): JSX.Element {
  const previewColor = activeFloorColor ?? DEFAULT_FLOOR_COLOR_ADJUST;
  const [showColor, setShowColor] = useState(false);

  function handlePresetSelect(color: OfficeTileColor): void {
    onSelectTileColor?.(color);
  }

  function handleColorChange(key: "h" | "s" | "b" | "c", value: number): void {
    const next = cloneOfficeColorAdjust(previewColor);
    next[key] = value;
    onSelectFloorColor?.(next);
  }

  return (
    <div style={subPanel}>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Pattern
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {FLOOR_PATTERN_ITEMS.map((item) => {
          return (
            <FloorPatternPreview
              key={item.id}
              patternId={item.id}
              atlasFrame={item.atlasFrame}
              colorAdjust={previewColor}
              selected={activeFloorPattern === item.id}
              onClick={() => onSelectFloorPattern?.(item.id)}
            />
          );
        })}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Tint
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {OFFICE_TILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => handlePresetSelect(color)}
            style={{
              padding: 2,
              background: activeTileColor === color ? "var(--pixel-active-bg)" : "var(--pixel-btn-bg)",
              border: activeTileColor === color ? "2px solid var(--pixel-accent)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            <FloorTilePreview colorAdjust={resolveOfficeFloorAppearance(null, color).colorAdjust} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setShowColor((v) => !v)}
          style={showColor ? btnActive : btnBase}
          title="Adjust floor color"
        >
          Color
        </button>
        <button
          type="button"
          onClick={() => onSelectFloorMode?.(activeFloorMode === "pick" ? "paint" : "pick")}
          style={activeFloorMode === "pick" ? btnActive : btnBase}
          title="Pick floor pattern and color from a tile"
        >
          Pick
        </button>
      </div>
      {showColor && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 6px", background: "var(--pixel-btn-bg)" }}>
          <ColorSlider label="H" value={previewColor.h} min={0} max={360} onChange={(value) => handleColorChange("h", value)} />
          <ColorSlider label="S" value={previewColor.s} min={0} max={100} onChange={(value) => handleColorChange("s", value)} />
          <ColorSlider label="B" value={previewColor.b} min={-100} max={100} onChange={(value) => handleColorChange("b", value)} />
          <ColorSlider label="C" value={previewColor.c} min={-100} max={100} onChange={(value) => handleColorChange("c", value)} />
        </div>
      )}
    </div>
  );
}

function WallSubPanel(): JSX.Element {
  const previewFrame = ENVIRONMENT_ATLAS_FRAMES["environment.walls.mask-00#0"];
  return (
    <div style={subPanel}>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Wall
      </div>
      {previewFrame ? <EnvironmentAtlasSprite frame={previewFrame.frame} /> : null}
    </div>
  );
}

function TerrainSubPanel({
  activeTerrainTool,
  onSelectTerrainTool,
}: {
  activeTerrainTool: TerrainToolSelection;
  onSelectTerrainTool: ((tool: TerrainToolSelection) => void) | undefined;
}): JSX.Element {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const hasAnimated = TERRAIN_TOOLBAR_PREVIEW_ITEMS.some(
      (item) => item.animationFrames.length > 1,
    );
    if (!hasAnimated) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, DEFAULT_TERRAIN_ANIMATION_FRAME_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={subPanel}>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Terrain
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {TERRAIN_TOOLBAR_PREVIEW_ITEMS.map((item) => {
          const isSelected =
            activeTerrainTool?.brushId === item.brushId &&
            activeTerrainTool?.materialId === item.materialId;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => {
                if (isSelected) {
                  onSelectTerrainTool?.(null);
                  return;
                }

                onSelectTerrainTool?.({
                  materialId: item.materialId,
                  brushId: item.brushId,
                });
              }}
              style={{
                background: isSelected ? "var(--pixel-active-bg)" : "var(--pixel-btn-bg)",
                border: isSelected ? "2px solid var(--pixel-accent)" : "2px solid transparent",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <TerrainPreviewSprite item={item} tick={tick} />
            </button>
          );
        })}
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

function EntitiesSubPanel({
  viewModel,
}: {
  viewModel: EntityToolbarViewModel;
}): JSX.Element {
  return (
    <div style={{ ...subPanel, maxWidth: 420 }}>
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
        Entities
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 220,
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        {viewModel.groups.map((group) => (
          <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--pixel-text)", opacity: 0.7 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {group.placeables.map((placeable) => (
                <div
                  key={placeable.id}
                  draggable
                  title={`Spawn ${placeable.label}`}
                  onDragStart={(event) => viewModel.onDragStart(event, placeable)}
                  style={{
                    background: "var(--pixel-btn-bg)",
                    border: "2px solid transparent",
                    color: "var(--pixel-text)",
                    cursor: "grab",
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: "5px 8px",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⊕ {placeable.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_TERRAIN_PREVIEW =
  TERRAIN_TOOLBAR_PREVIEW_ITEMS.find((item) => item.brushId === "ground") ??
  TERRAIN_TOOLBAR_PREVIEW_ITEMS[0] ??
  null;

export function BottomToolbar({
  isLayoutMode,
  onToggleLayoutMode,
  isJsonEditorOpen = false,
  onToggleJsonEditor,
  entityToolbarViewModel = null,
  activeTool = null,
  onSelectTool,
  activeFloorMode = "paint",
  onSelectFloorMode,
  activeTileColor,
  onSelectTileColor,
  activeFloorColor,
  onSelectFloorColor,
  activeFloorPattern,
  onSelectFloorPattern,
  activeFurnitureId,
  onSelectFurnitureId,
  activeTerrainTool = null,
  onSelectTerrainTool,
  onResetLayout,
  onSaveLayout,
  canResetLayout = false,
  canSaveLayout = false,
  isLayoutDirty = false,
  isTerrainDirty = false,
  isSavingLayout = false,
  layoutStatusText = null,
}: BottomToolbarProps): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isEntitiesPanelOpen, setIsEntitiesPanelOpen] = useState(false);

  useEffect(() => {
    if (!entityToolbarViewModel) {
      setIsEntitiesPanelOpen(false);
    }
  }, [entityToolbarViewModel]);

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
    onSelectTerrainTool?.(null);
    onSelectTool?.(activeTool === tool ? null : tool);
  }

  function handleTerrainButtonClick(): void {
    if (activeTerrainTool) {
      onSelectTerrainTool?.(null);
      return;
    }

    if (!DEFAULT_TERRAIN_PREVIEW) {
      return;
    }

    onSelectTerrainTool?.({
      materialId: DEFAULT_TERRAIN_PREVIEW.materialId,
      brushId: DEFAULT_TERRAIN_PREVIEW.brushId,
    });
  }

  function handleToggleLayoutMode(): void {
    if (isLayoutMode) {
      onSelectTerrainTool?.(null);
    }

    onToggleLayoutMode();
  }

  return (
    <div style={outerContainer}>
      {/* Sub-panels (appear above button row) */}
      {!isLayoutMode && isEntitiesPanelOpen && entityToolbarViewModel ? (
        <EntitiesSubPanel viewModel={entityToolbarViewModel} />
      ) : null}
      {isLayoutMode && activeTool === "floor" && (
        <FloorSubPanel
          activeFloorMode={activeFloorMode}
          activeTileColor={activeTileColor}
          onSelectTileColor={onSelectTileColor}
          activeFloorColor={activeFloorColor}
          onSelectFloorColor={onSelectFloorColor}
          activeFloorPattern={activeFloorPattern}
          onSelectFloorPattern={onSelectFloorPattern}
          onSelectFloorMode={onSelectFloorMode}
        />
      )}
      {isLayoutMode && activeTerrainTool && (
        <TerrainSubPanel
          activeTerrainTool={activeTerrainTool}
          onSelectTerrainTool={onSelectTerrainTool}
        />
      )}
      {isLayoutMode && activeTool === "wall" && <WallSubPanel />}
      {isLayoutMode && activeTool === "furniture" && (
        <FurnitureSubPanel activeFurnitureId={activeFurnitureId} onSelectFurnitureId={onSelectFurnitureId} />
      )}

      {/* Button row */}
      <div style={panelRow}>
        <button
          type="button"
          onClick={handleToggleLayoutMode}
          onMouseEnter={() => setHovered("layout")}
          onMouseLeave={() => setHovered(null)}
          style={resolveButtonStyle("layout", { active: isLayoutMode })}
          title="Toggle layout editing mode"
        >
          Layout{isLayoutDirty ? "*" : ""}
        </button>

        <button
          type="button"
          disabled={!entityToolbarViewModel}
          onClick={() => setIsEntitiesPanelOpen((open) => !open)}
          onMouseEnter={() => setHovered("entities")}
          onMouseLeave={() => setHovered(null)}
          style={resolveButtonStyle("entities", {
            active: isEntitiesPanelOpen,
            disabled: !entityToolbarViewModel,
          })}
          title="Entity placeables"
        >
          Entities
        </button>

        {isLayoutMode && (
          <>
            <div style={divider} />
            <button
              type="button"
              onClick={() => handleToolClick("floor")}
              onMouseEnter={() => setHovered("floor")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("floor", { active: activeTool === "floor" })}
              title="Floor tool"
            >
              Floor
            </button>
            <button
              type="button"
              onClick={handleTerrainButtonClick}
              onMouseEnter={() => setHovered("terrain")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("terrain", { active: Boolean(activeTerrainTool) })}
              title="Terrain tool"
            >
              Terrain
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("wall")}
              onMouseEnter={() => setHovered("wall")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("wall", { active: activeTool === "wall" })}
              title="Wall tool"
            >
              Wall
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("erase")}
              onMouseEnter={() => setHovered("erase")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("erase", { active: activeTool === "erase" })}
              title="Erase tool"
            >
              Erase
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("furniture")}
              onMouseEnter={() => setHovered("furniture")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("furniture", { active: activeTool === "furniture" })}
              title="Furniture tool"
            >
              Furniture
            </button>

            <div style={divider} />

            <button
              type="button"
              disabled={!canSaveLayout}
              onClick={onSaveLayout}
              onMouseEnter={() => setHovered("save")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("save", { disabled: !canSaveLayout })}
              title="Save combined layout data"
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
              title={
                isTerrainDirty
                  ? "Reset office layout changes; terrain edits can only be committed via Save"
                  : "Reset unsaved office layout changes"
              }
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
