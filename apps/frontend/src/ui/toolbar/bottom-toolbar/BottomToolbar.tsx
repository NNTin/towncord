import { useEffect, useState } from "react";
import {
  ATLAS_H,
  ATLAS_IMAGE_URL,
  ATLAS_W,
  BLOOMSEED_ATLAS_H,
  BLOOMSEED_ATLAS_IMAGE_URL,
  BLOOMSEED_ATLAS_W,
  DEFAULT_FLOOR_COLOR_ADJUST,
  DEFAULT_WALL_COLOR_ADJUST,
  DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  DEFAULT_TERRAIN_SOURCE_ID,
  ENVIRONMENT_ATLAS_FRAMES,
  ENVIRONMENT_ATLAS_H,
  ENVIRONMENT_ATLAS_IMAGE_URL,
  ENVIRONMENT_ATLAS_W,
  FARMRPG_GRASS_TERRAIN_SOURCE_ID,
  FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS,
  FARMRPG_ATLAS_H,
  FARMRPG_ATLAS_IMAGE_URL,
  FARMRPG_ATLAS_W,
  FLOOR_PATTERN_ITEMS,
  canRotateFurniturePaletteItem,
  FURNITURE_ALL_ITEMS,
  FURNITURE_PALETTE_CATEGORIES,
  FURNITURE_PALETTE_ITEMS,
  OFFICE_TILE_COLORS,
  cloneOfficeColorAdjust,
  getBloomseedAtlasFrame,
  getFarmrpgAtlasFrame,
  resolveFurnitureRotationVariant,
  resolveOfficeFloorAppearance,
  resolveOfficeWallAppearance,
  TERRAIN_TOOLBAR_PREVIEW_ITEMS,
  tintToHexCss,
  type FurniturePaletteItem,
  type FurnitureRotationQuarterTurns,
  type OfficeColorAdjust,
  type OfficeTileColor,
  type TerrainToolbarPreviewFrame,
  type TerrainToolbarPreviewItem,
} from "../../../game/contracts/content";
import type { OfficeFloorMode } from "../../../game/contracts/office-editor";
import type { TerrainToolSelection } from "../../../game/contracts/runtime";
import type {
  EntityToolbarViewModel,
  SelectedOfficePlaceableViewModel,
} from "../../game-session/contracts";

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
  activeWallColor?: OfficeColorAdjust | null;
  onSelectWallColor?: (color: OfficeColorAdjust) => void;
  activeFurnitureId?: string | null;
  activeFurnitureRotationQuarterTurns?: FurnitureRotationQuarterTurns;
  onSelectFurnitureId?: (id: string) => void;
  onRotateFurnitureClockwise?: () => void;
  activeTerrainTool?: TerrainToolSelection;
  onSelectTerrainTool?: (tool: TerrainToolSelection) => void;
  selectedOfficePlaceable?: SelectedOfficePlaceableViewModel;
  onRotateSelectedOfficePlaceable?: () => void;
  onDeleteSelectedOfficePlaceable?: () => void;
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

type BottomToolbarProps = LayoutModeProps &
  ToolSelectionProps &
  PersistenceProps;

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

const actionPanel: React.CSSProperties = {
  ...subPanel,
  gap: 8,
  maxWidth: 420,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  alignItems: "center",
};

const sectionLabel: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 11,
  color: "var(--pixel-text)",
  opacity: 0.7,
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

function FurnitureSprite({
  item,
}: {
  item: FurniturePaletteItem;
}): JSX.Element {
  return (
    <AtlasSprite
      atlasUrl={ATLAS_IMAGE_URL}
      atlasW={ATLAS_W}
      atlasH={ATLAS_H}
      frame={item.atlasFrame}
    />
  );
}

// Entity sprites are 64×64 px; scale to 0.5 so they display at 32×32 px like furniture thumbnails.
const ENTITY_PREVIEW_SCALE = 0.5;

function EntityPreviewSprite({
  frameKey,
}: {
  frameKey: string;
}): JSX.Element | null {
  const bloomseedFrame = getBloomseedAtlasFrame(frameKey);
  if (bloomseedFrame) {
    return (
      <AtlasSprite
        atlasUrl={BLOOMSEED_ATLAS_IMAGE_URL}
        atlasW={BLOOMSEED_ATLAS_W}
        atlasH={BLOOMSEED_ATLAS_H}
        frame={bloomseedFrame}
        scale={ENTITY_PREVIEW_SCALE}
      />
    );
  }

  const farmrpgFrame = getFarmrpgAtlasFrame(frameKey);
  if (farmrpgFrame) {
    return (
      <AtlasSprite
        atlasUrl={FARMRPG_ATLAS_IMAGE_URL}
        atlasW={FARMRPG_ATLAS_W}
        atlasH={FARMRPG_ATLAS_H}
        frame={farmrpgFrame}
        scale={ENTITY_PREVIEW_SCALE}
      />
    );
  }

  return null;
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

function TerrainAtlasSprite({
  frame,
}: {
  frame: TerrainToolbarPreviewFrame;
}): JSX.Element {
  return (
    <AtlasSprite
      atlasUrl={frame.atlasImageUrl}
      atlasW={frame.atlasW}
      atlasH={frame.atlasH}
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
    item.animationFrames.length > 1 ? tick % item.animationFrames.length : 0;
  const frame = item.animationFrames[phaseIndex] ?? item.representativeFrame;
  return <TerrainAtlasSprite frame={frame} />;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildBreadcrumbText(segments: string[]): string {
  return segments.join(" > ");
}

function resolveFurnitureBreadcrumbs(item: FurniturePaletteItem): string[] {
  const breadcrumbs = ["Layout", "Furniture", titleCase(item.category)];
  if (item.groupId) {
    breadcrumbs.push(titleCase(item.groupId));
  }
  breadcrumbs.push(item.label);
  return breadcrumbs;
}

function resolveSelectedFurnitureItem(
  selectedOfficePlaceable: SelectedOfficePlaceableViewModel | undefined,
): FurniturePaletteItem | null {
  if (
    !selectedOfficePlaceable ||
    selectedOfficePlaceable.kind !== "furniture"
  ) {
    return null;
  }

  return (
    FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === selectedOfficePlaceable.assetId,
    ) ??
    FURNITURE_ALL_ITEMS.find(
      (item) => item.id === selectedOfficePlaceable.assetId,
    ) ??
    null
  );
}

function resolveSelectedPlaceableBreadcrumbs(
  selectedOfficePlaceable: NonNullable<SelectedOfficePlaceableViewModel>,
  previewItem: FurniturePaletteItem | null,
): string[] {
  const breadcrumbs = [
    "Layout",
    "Selected",
    titleCase(selectedOfficePlaceable.category),
  ];
  if (previewItem?.groupId) {
    breadcrumbs.push(titleCase(previewItem.groupId));
  }
  breadcrumbs.push(selectedOfficePlaceable.label);
  return breadcrumbs;
}

function formatRotationLabel(
  quarterTurns: FurnitureRotationQuarterTurns | number,
): string {
  return `${(quarterTurns % 4) * 90}°`;
}

function resolveEntityBreadcrumbs(groupLabel: string, label: string): string[] {
  const breadcrumbs = ["Entity", groupLabel];
  if (label !== groupLabel) {
    breadcrumbs.push(label);
  }
  return breadcrumbs;
}

function PreviewCard({
  breadcrumbs,
  description,
  title,
  visual,
}: {
  breadcrumbs: string[];
  description: string;
  title: string;
  visual?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "stretch",
        border: "2px solid var(--pixel-border)",
        background: "var(--pixel-bg)",
        boxShadow: "var(--pixel-shadow)",
        padding: 8,
      }}
    >
      <div
        style={{
          minWidth: 72,
          minHeight: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--pixel-btn-bg)",
          border: "1px solid var(--pixel-border)",
          padding: 4,
          flexShrink: 0,
        }}
      >
        {visual ?? (
          <div
            style={{
              color: "var(--pixel-text)",
              fontFamily: "monospace",
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            ⊕
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
        }}
      >
        <div
          style={{
            color: "var(--pixel-text)",
            fontFamily: "monospace",
            fontSize: 11,
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          {buildBreadcrumbText(breadcrumbs)}
        </div>
        <div
          style={{
            color: "var(--pixel-text)",
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "var(--pixel-text)",
            fontFamily: "monospace",
            fontSize: 11,
            opacity: 0.8,
            whiteSpace: "normal",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
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
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          width: 14,
        }}
      >
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
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          width: 28,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ColorAdjustControls({
  colorAdjust,
  onChange,
}: {
  colorAdjust: OfficeColorAdjust;
  onChange: (key: "h" | "s" | "b" | "c", value: number) => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "4px 6px",
        background: "var(--pixel-btn-bg)",
      }}
    >
      <ColorSlider
        label="H"
        value={colorAdjust.h}
        min={0}
        max={360}
        onChange={(value) => onChange("h", value)}
      />
      <ColorSlider
        label="S"
        value={colorAdjust.s}
        min={0}
        max={100}
        onChange={(value) => onChange("s", value)}
      />
      <ColorSlider
        label="B"
        value={colorAdjust.b}
        min={-100}
        max={100}
        onChange={(value) => onChange("b", value)}
      />
      <ColorSlider
        label="C"
        value={colorAdjust.c}
        min={-100}
        max={100}
        onChange={(value) => onChange("c", value)}
      />
    </div>
  );
}

function FloorTilePreview({
  colorAdjust,
}: {
  colorAdjust: OfficeColorAdjust;
}): JSX.Element {
  const defaultFrame =
    ENVIRONMENT_ATLAS_FRAMES["environment.floors.pattern-01#0"];
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

function WallTilePreview({
  colorAdjust,
}: {
  colorAdjust: OfficeColorAdjust;
}): JSX.Element {
  const defaultFrame = ENVIRONMENT_ATLAS_FRAMES["environment.walls.mask-00#0"];
  const { tint } = resolveOfficeWallAppearance(colorAdjust);
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
  onHover,
  onClearHover,
}: {
  patternId: string;
  atlasFrame?: { x: number; y: number; w: number; h: number };
  colorAdjust: OfficeColorAdjust;
  selected: boolean;
  onClick: () => void;
  onHover?: () => void;
  onClearHover?: () => void;
}): JSX.Element {
  const frame =
    atlasFrame ??
    ENVIRONMENT_ATLAS_FRAMES["environment.floors.pattern-01#0"]?.frame;
  if (!frame) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={selected ? btnActive : btnBase}
      >
        {patternId}
      </button>
    );
  }

  const { tint } = resolveOfficeFloorAppearance(colorAdjust, null);
  return (
    <button
      type="button"
      title={patternId}
      onMouseEnter={onHover}
      onMouseLeave={onClearHover}
      onFocus={onHover}
      onBlur={onClearHover}
      onClick={onClick}
      style={{
        padding: 2,
        background: selected ? "var(--pixel-active-bg)" : "var(--pixel-btn-bg)",
        border: selected
          ? "2px solid var(--pixel-accent)"
          : "2px solid transparent",
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
  const [hoveredPatternId, setHoveredPatternId] = useState<string | null>(null);
  const [hoveredTileColor, setHoveredTileColor] =
    useState<OfficeTileColor | null>(null);
  const previewPatternId =
    hoveredPatternId ??
    activeFloorPattern ??
    FLOOR_PATTERN_ITEMS[0]?.id ??
    null;
  const previewPattern =
    FLOOR_PATTERN_ITEMS.find((item) => item.id === previewPatternId) ??
    FLOOR_PATTERN_ITEMS[0] ??
    null;
  const previewTileColor = hoveredTileColor ?? activeTileColor ?? null;
  const previewAppearance = resolveOfficeFloorAppearance(
    previewColor,
    previewTileColor,
  );

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
      <PreviewCard
        breadcrumbs={[
          "Layout",
          "Floor",
          previewPattern?.id ?? "Pattern",
          previewTileColor ?? "Tint",
        ]}
        description="This is the floor tile style that will be painted into the scene."
        title={previewPattern?.id ?? "Floor preview"}
        visual={
          previewPattern?.atlasFrame ? (
            <TintedAtlasSprite
              frame={previewPattern.atlasFrame}
              tint={previewAppearance.tint}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                background:
                  tintToHexCss(previewAppearance.tint) ?? "var(--pixel-btn-bg)",
              }}
            />
          )
        }
      />

      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          opacity: 0.7,
        }}
      >
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
              onHover={() => setHoveredPatternId(item.id)}
              onClearHover={() => setHoveredPatternId(null)}
              onClick={() => {
                setHoveredPatternId(item.id);
                onSelectFloorPattern?.(item.id);
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          opacity: 0.7,
        }}
      >
        Tint
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {OFFICE_TILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onMouseEnter={() => setHoveredTileColor(color)}
            onMouseLeave={() => setHoveredTileColor(null)}
            onFocus={() => setHoveredTileColor(color)}
            onBlur={() => setHoveredTileColor(null)}
            onClick={() => handlePresetSelect(color)}
            style={{
              padding: 2,
              background:
                activeTileColor === color
                  ? "var(--pixel-active-bg)"
                  : "var(--pixel-btn-bg)",
              border:
                activeTileColor === color
                  ? "2px solid var(--pixel-accent)"
                  : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            <FloorTilePreview
              colorAdjust={
                resolveOfficeFloorAppearance(null, color).colorAdjust
              }
            />
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
          onClick={() =>
            onSelectFloorMode?.(activeFloorMode === "pick" ? "paint" : "pick")
          }
          style={activeFloorMode === "pick" ? btnActive : btnBase}
          title="Pick floor pattern and color from a tile"
        >
          Pick
        </button>
      </div>
      {showColor && (
        <ColorAdjustControls
          colorAdjust={previewColor}
          onChange={handleColorChange}
        />
      )}
    </div>
  );
}

function WallSubPanel({
  activeWallColor,
  onSelectWallColor,
}: {
  activeWallColor: OfficeColorAdjust | null | undefined;
  onSelectWallColor: ((color: OfficeColorAdjust) => void) | undefined;
}): JSX.Element {
  const previewColor = activeWallColor ?? DEFAULT_WALL_COLOR_ADJUST;
  const [showColor, setShowColor] = useState(false);

  function handleColorChange(key: "h" | "s" | "b" | "c", value: number): void {
    const next = cloneOfficeColorAdjust(previewColor);
    next[key] = value;
    onSelectWallColor?.(next);
  }

  return (
    <div style={subPanel}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          opacity: 0.7,
        }}
      >
        Wall
      </div>
      <PreviewCard
        breadcrumbs={["Layout", "Wall"]}
        description="Paint wall tiles with the selected tint. Right-click removes wall tiles."
        title="Wall placement"
        visual={<WallTilePreview colorAdjust={previewColor} />}
      />
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setShowColor((value) => !value)}
          style={showColor ? btnActive : btnBase}
          title="Adjust wall color"
        >
          Color
        </button>
      </div>
      {showColor && (
        <ColorAdjustControls
          colorAdjust={previewColor}
          onChange={handleColorChange}
        />
      )}
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
  const [tilesetId, setTilesetId] = useState<"debug" | "farmrpg">(
    activeTerrainTool?.terrainSourceId === FARMRPG_GRASS_TERRAIN_SOURCE_ID
      ? "farmrpg"
      : "debug",
  );

  useEffect(() => {
    if (activeTerrainTool?.terrainSourceId === FARMRPG_GRASS_TERRAIN_SOURCE_ID) {
      setTilesetId("farmrpg");
    } else if (activeTerrainTool?.terrainSourceId === DEFAULT_TERRAIN_SOURCE_ID) {
      setTilesetId("debug");
    }
  }, [activeTerrainTool?.terrainSourceId]);

  const items =
    tilesetId === "farmrpg"
      ? FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS
      : TERRAIN_TOOLBAR_PREVIEW_ITEMS;

  useEffect(() => {
    const hasAnimated = items.some((item) => item.animationFrames.length > 1);
    if (!hasAnimated) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, DEFAULT_TERRAIN_ANIMATION_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [items]);

  return (
    <div style={subPanel}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--pixel-text)",
          opacity: 0.7,
        }}
      >
        Terrain
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setTilesetId("debug")}
          style={{
            background:
              tilesetId === "debug"
                ? "var(--pixel-active-bg)"
                : "var(--pixel-btn-bg)",
            border:
              tilesetId === "debug"
                ? "2px solid var(--pixel-accent)"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 10,
            color: "var(--pixel-text)",
            padding: "2px 4px",
          }}
        >
          Debug
        </button>
        <button
          type="button"
          onClick={() => setTilesetId("farmrpg")}
          style={{
            background:
              tilesetId === "farmrpg"
                ? "var(--pixel-active-bg)"
                : "var(--pixel-btn-bg)",
            border:
              tilesetId === "farmrpg"
                ? "2px solid var(--pixel-accent)"
                : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 10,
            color: "var(--pixel-text)",
            padding: "2px 4px",
          }}
        >
          FarmRPG
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {items.map((item) => {
          const activeTerrainSourceId =
            activeTerrainTool?.terrainSourceId ??
            DEFAULT_TERRAIN_PREVIEW?.terrainSourceId ??
            DEFAULT_TERRAIN_SOURCE_ID;
          const isSelected =
            activeTerrainTool?.brushId === item.brushId &&
            activeTerrainTool?.materialId === item.materialId &&
            activeTerrainSourceId === item.terrainSourceId;
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
                  terrainSourceId: item.terrainSourceId,
                });
              }}
              style={{
                background: isSelected
                  ? "var(--pixel-active-bg)"
                  : "var(--pixel-btn-bg)",
                border: isSelected
                  ? "2px solid var(--pixel-accent)"
                  : "2px solid transparent",
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
  activeFurnitureRotationQuarterTurns,
  onSelectFurnitureId,
  onRotateFurnitureClockwise,
}: {
  activeFurnitureId: string | null | undefined;
  activeFurnitureRotationQuarterTurns:
    | FurnitureRotationQuarterTurns
    | null
    | undefined;
  onSelectFurnitureId: ((id: string) => void) | undefined;
  onRotateFurnitureClockwise: (() => void) | undefined;
}): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string>(
    FURNITURE_PALETTE_CATEGORIES[0] ?? "desks",
  );
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const selectedItem =
    FURNITURE_PALETTE_ITEMS.find((item) => item.id === activeFurnitureId) ??
    null;
  useEffect(() => {
    if (selectedItem) {
      setActiveCategory(selectedItem.category);
    }
  }, [selectedItem]);
  const items = FURNITURE_PALETTE_ITEMS.filter(
    (i) => i.category === activeCategory,
  );
  const previewSourceItem =
    FURNITURE_PALETTE_ITEMS.find((item) => item.id === hoveredItemId) ??
    selectedItem ??
    items.find((item) => item.id === activeFurnitureId) ??
    items[0] ??
    null;
  const previewItem = resolveFurnitureRotationVariant(
    previewSourceItem?.id ?? null,
    activeFurnitureRotationQuarterTurns ?? 0,
  );
  const canRotatePreviewItem = canRotateFurniturePaletteItem(
    previewSourceItem?.id,
  );

  return (
    <div style={subPanel}>
      <PreviewCard
        breadcrumbs={
          previewItem
            ? resolveFurnitureBreadcrumbs(previewItem)
            : ["Layout", "Furniture"]
        }
        description={
          previewItem
            ? "Choose the asset and rotation here. The final ghost preview follows your pointer inside the office scene."
            : "Choose a category, then place and rotate furniture from the office scene preview."
        }
        title={previewItem?.label ?? "Furniture details"}
        visual={previewItem ? <FurnitureSprite item={previewItem} /> : null}
      />

      {previewItem ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 11,
            color: "var(--pixel-text)",
            opacity: 0.82,
          }}
        >
          <div>Placement: {previewItem.placement}</div>
          <div>
            Footprint: {previewItem.footprintW}x{previewItem.footprintH}
          </div>
          <div>
            Rotation:{" "}
            {formatRotationLabel(activeFurnitureRotationQuarterTurns ?? 0)}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={!canRotatePreviewItem}
          onClick={() => onRotateFurnitureClockwise?.()}
          style={{
            ...btnBase,
            opacity: canRotatePreviewItem ? 1 : 0.5,
            cursor: canRotatePreviewItem ? "pointer" : "default",
          }}
          title={
            canRotatePreviewItem
              ? "Rotate the pending furniture preview"
              : "This furniture asset has no alternate orientation"
          }
        >
          Rotate
        </button>
      </div>

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
              ...(activeCategory === cat
                ? {
                    background: "var(--pixel-active-bg)",
                    border: "2px solid var(--pixel-accent)",
                  }
                : {}),
            }}
          >
            {cat}
          </button>
        ))}
      </div>

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
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
            onFocus={() => setHoveredItemId(item.id)}
            onBlur={() => setHoveredItemId(null)}
            onClick={() => onSelectFurnitureId?.(item.id)}
            style={{
              background:
                activeFurnitureId === item.id
                  ? "var(--pixel-active-bg)"
                  : "var(--pixel-btn-bg)",
              border:
                activeFurnitureId === item.id
                  ? "2px solid var(--pixel-accent)"
                  : "2px solid transparent",
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

function LayoutOverviewSubPanel({
  selectedOfficePlaceable,
  onRotateSelectedOfficePlaceable,
  onDeleteSelectedOfficePlaceable,
}: {
  selectedOfficePlaceable: SelectedOfficePlaceableViewModel | undefined;
  onRotateSelectedOfficePlaceable: (() => void) | undefined;
  onDeleteSelectedOfficePlaceable: (() => void) | undefined;
}): JSX.Element {
  const previewItem = resolveSelectedFurnitureItem(selectedOfficePlaceable);
  const canRotate = Boolean(selectedOfficePlaceable?.canRotate);

  if (!selectedOfficePlaceable) {
    return (
      <div style={subPanel}>
        <PreviewCard
          breadcrumbs={["Layout"]}
          description="Choose Floor, Terrain, Wall, Erase, or Furniture to make a layout change."
          title="Layout editing"
        />
      </div>
    );
  }

  return (
    <div style={subPanel}>
      <PreviewCard
        breadcrumbs={resolveSelectedPlaceableBreadcrumbs(
          selectedOfficePlaceable,
          previewItem,
        )}
        description={
          canRotate
            ? "This furniture is selected. Rotate or delete it to fix the placement in context."
            : "This furniture is selected. Delete it or change the active asset if it needs a different orientation."
        }
        title={selectedOfficePlaceable.label}
        visual={previewItem ? <FurnitureSprite item={previewItem} /> : null}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={!canRotate}
          onClick={() => onRotateSelectedOfficePlaceable?.()}
          style={{
            ...btnBase,
            opacity: canRotate ? 1 : 0.5,
            cursor: canRotate ? "pointer" : "default",
          }}
          title={
            canRotate
              ? "Rotate selected placeable"
              : "This selected placeable has no alternate orientation"
          }
        >
          Rotate
        </button>
        <button
          type="button"
          onClick={() => onDeleteSelectedOfficePlaceable?.()}
          style={btnBase}
          title="Delete selected placeable"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EntitiesSubPanel({
  viewModel,
}: {
  viewModel: EntityToolbarViewModel;
}): JSX.Element {
  const firstGroup = viewModel.groups[0] ?? null;
  const firstPlaceable = firstGroup?.placeables[0] ?? null;
  const [hoveredPlaceableId, setHoveredPlaceableId] = useState<string | null>(
    null,
  );
  const previewPlaceable =
    viewModel.groups
      .flatMap((group) => group.placeables)
      .find((placeable) => placeable.id === hoveredPlaceableId) ??
    firstPlaceable;

  return (
    <div style={{ ...subPanel, maxWidth: 420 }}>
      <PreviewCard
        breadcrumbs={
          previewPlaceable
            ? resolveEntityBreadcrumbs(
                previewPlaceable.groupLabel,
                previewPlaceable.label,
              )
            : ["Entity"]
        }
        description={
          previewPlaceable
            ? "Preview the entity that will be dragged into the world."
            : "Hover an entity to preview it."
        }
        title={previewPlaceable?.label ?? "Entity preview"}
      />
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
          <div
            key={group.key}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--pixel-text)",
                opacity: 0.7,
              }}
            >
              {group.label}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {group.placeables.map((placeable) => (
                <div
                  key={placeable.id}
                  draggable
                  tabIndex={0}
                  title={`Spawn ${placeable.label}`}
                  onMouseEnter={() => setHoveredPlaceableId(placeable.id)}
                  onMouseLeave={() => setHoveredPlaceableId(null)}
                  onFocus={() => setHoveredPlaceableId(placeable.id)}
                  onBlur={() => setHoveredPlaceableId(null)}
                  onDragStart={(event) =>
                    viewModel.onDragStart(event, placeable)
                  }
                  style={{
                    background: "var(--pixel-btn-bg)",
                    border: "2px solid transparent",
                    color: "var(--pixel-text)",
                    cursor: "grab",
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: placeable.previewFrameKey ? "4px" : "5px 8px",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {placeable.previewFrameKey ? (
                    <EntityPreviewSprite frameKey={placeable.previewFrameKey} />
                  ) : (
                    `⊕ ${placeable.label}`
                  )}
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
  activeWallColor,
  onSelectWallColor,
  activeFurnitureId,
  activeFurnitureRotationQuarterTurns = 0,
  onSelectFurnitureId,
  onRotateFurnitureClockwise,
  activeTerrainTool = null,
  onSelectTerrainTool,
  selectedOfficePlaceable,
  onRotateSelectedOfficePlaceable,
  onDeleteSelectedOfficePlaceable,
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

  useEffect(() => {
    if (isLayoutMode) {
      setIsEntitiesPanelOpen(false);
    }
  }, [isLayoutMode]);

  function resolveButtonStyle(
    key: string,
    options: { active?: boolean; disabled?: boolean } = {},
  ): React.CSSProperties {
    const { active = false, disabled = false } = options;
    if (active) return btnActive;
    return {
      ...btnBase,
      background:
        hovered === key && !disabled
          ? "var(--pixel-btn-hover-bg)"
          : btnBase.background,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled
        ? ("var(--pixel-btn-disabled-opacity)" as unknown as number)
        : 1,
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
      terrainSourceId: DEFAULT_TERRAIN_PREVIEW.terrainSourceId,
    });
  }

  function closeLayoutPanel(): void {
    if (!isLayoutMode) {
      return;
    }

    onSelectTool?.(null);
    onSelectTerrainTool?.(null);
    onToggleLayoutMode();
  }

  function handleLayoutButtonClick(): void {
    setIsEntitiesPanelOpen(false);
    if (isLayoutMode) {
      closeLayoutPanel();
      return;
    }

    onToggleLayoutMode();
  }

  function handleEntityButtonClick(): void {
    if (!entityToolbarViewModel) {
      return;
    }

    if (isEntitiesPanelOpen) {
      setIsEntitiesPanelOpen(false);
      return;
    }

    if (isLayoutMode) {
      closeLayoutPanel();
    }

    setIsEntitiesPanelOpen(true);
  }

  return (
    <div style={outerContainer}>
      {/* Sub-panels (appear above button row) */}
      {!isLayoutMode && isEntitiesPanelOpen && entityToolbarViewModel ? (
        <EntitiesSubPanel viewModel={entityToolbarViewModel} />
      ) : null}
      {isLayoutMode &&
      (selectedOfficePlaceable || (!activeTool && !activeTerrainTool)) ? (
        <LayoutOverviewSubPanel
          selectedOfficePlaceable={selectedOfficePlaceable}
          onRotateSelectedOfficePlaceable={onRotateSelectedOfficePlaceable}
          onDeleteSelectedOfficePlaceable={onDeleteSelectedOfficePlaceable}
        />
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
      {isLayoutMode && activeTool === "wall" && (
        <WallSubPanel
          activeWallColor={activeWallColor}
          onSelectWallColor={onSelectWallColor}
        />
      )}
      {isLayoutMode && activeTool === "furniture" && (
        <FurnitureSubPanel
          activeFurnitureId={activeFurnitureId}
          activeFurnitureRotationQuarterTurns={
            activeFurnitureRotationQuarterTurns
          }
          onSelectFurnitureId={onSelectFurnitureId}
          onRotateFurnitureClockwise={onRotateFurnitureClockwise}
        />
      )}
      {isLayoutMode && (
        <div style={actionPanel}>
          <div style={sectionLabel}>Layout</div>
          <div style={actionRow}>
            <button
              type="button"
              onClick={() => handleToolClick("floor")}
              onMouseEnter={() => setHovered("floor")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("floor", {
                active: activeTool === "floor",
              })}
              title="Floor tool"
            >
              Floor
            </button>
            <button
              type="button"
              onClick={handleTerrainButtonClick}
              onMouseEnter={() => setHovered("terrain")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("terrain", {
                active: Boolean(activeTerrainTool),
              })}
              title="Terrain tool"
            >
              Terrain
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("wall")}
              onMouseEnter={() => setHovered("wall")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("wall", {
                active: activeTool === "wall",
              })}
              title="Wall tool"
            >
              Wall
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("erase")}
              onMouseEnter={() => setHovered("erase")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("erase", {
                active: activeTool === "erase",
              })}
              title="Erase tool"
            >
              Erase
            </button>
            <button
              type="button"
              onClick={() => handleToolClick("furniture")}
              onMouseEnter={() => setHovered("furniture")}
              onMouseLeave={() => setHovered(null)}
              style={resolveButtonStyle("furniture", {
                active: activeTool === "furniture",
              })}
              title="Furniture tool"
            >
              Furniture
            </button>
          </div>
          <div style={actionRow}>
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
          </div>
        </div>
      )}

      {/* Button row */}
      <div style={panelRow}>
        <button
          type="button"
          onClick={handleLayoutButtonClick}
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
          onClick={handleEntityButtonClick}
          onMouseEnter={() => setHovered("entities")}
          onMouseLeave={() => setHovered(null)}
          style={resolveButtonStyle("entities", {
            active: isEntitiesPanelOpen,
            disabled: !entityToolbarViewModel,
          })}
          title="Entity placeables"
        >
          Entity
        </button>
      </div>
    </div>
  );
}
