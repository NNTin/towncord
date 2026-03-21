import type { OfficeTileColor } from "../../office/model";
import type { OfficeCellCoord } from "../../town/layout";
import type { OfficeSceneFurniture, OfficeSceneFurnitureCategory, OfficeSceneLayout } from "../office/bootstrap";
import {
  cloneOfficeColorAdjust,
  officeColorAdjustEquals,
  OFFICE_TILE_COLOR_TINTS,
  resolveOfficeTileColorAdjustPreset,
  resolveOfficeTileTint,
  type OfficeColorAdjust,
} from "../office/colors";
import { FURNITURE_PALETTE_ITEMS } from "../../office/officeFurniturePalette";
import type { OfficeEditorToolId } from "../../events";

// Monotonic counter for unique furniture placement IDs. Module-level so it
// survives re-instantiation of OfficeEditorSystem across re-renders.
let nextFurniturePlacementId = 1;

type OfficeEditorCommand = {
  tool: OfficeEditorToolId;
  cell: OfficeCellCoord;
  /** Active tile-color key (only used by the "floor" tool). */
  tileColor: OfficeTileColor | null;
  /** Raw floor color-adjust data (only used by the "floor" tool when provided). */
  floorColor: OfficeColorAdjust | null;
  /** Active floor pattern ID (only used by the "floor" tool), e.g. "environment.floors.pattern-02". */
  floorPattern: string | null;
  /** Active furniture asset ID (only used by the "furniture" tool). */
  furnitureId: string | null;
};

/**
 * Owns the office editor tool dispatch logic.
 *
 * `applyCommand` accepts the current layout document and a command describing
 * which tool to apply and where.  It mutates the layout in place and returns
 * `true` when the layout changed (i.e. the caller should mark the office as
 * dirty and schedule a re-render), or `false` when no mutation occurred.
 *
 * WorldScene dispatches commands to this system rather than containing the
 * mutation logic itself, keeping the switch statement independently testable.
 */
export class OfficeEditorSystem {
  /**
   * Applies `command` to `layout`, mutating it in place.
   *
   * @returns `true` if the layout was modified; `false` otherwise.
   */
  applyCommand(layout: OfficeSceneLayout, command: OfficeEditorCommand): boolean {
    const { tool, cell } = command;
    const idx = cell.row * layout.cols + cell.col;

    switch (tool) {
      case "floor":
        return this.applyFloor(layout, idx, command.tileColor, command.floorColor, command.floorPattern);

      case "wall":
        return this.applyWall(layout, idx);

      case "erase":
        return this.applyErase(layout, idx, cell);

      case "furniture":
        return this.applyFurniture(layout, cell, command.furnitureId);
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Tool handlers
  // -------------------------------------------------------------------------

  private applyFloor(
    layout: OfficeSceneLayout,
    idx: number,
    tileColor: OfficeTileColor | null,
    floorColor: OfficeColorAdjust | null,
    floorPattern: string | null,
  ): boolean {
    const tile = layout.tiles[idx];
    if (!tile) return false;
    const neutralTint = OFFICE_TILE_COLOR_TINTS.neutral ?? 0x475569;
    const colorAdjust = floorColor
      ? cloneOfficeColorAdjust(floorColor)
      : resolveOfficeTileColorAdjustPreset(tileColor);
    const tint = floorColor
      ? resolveOfficeTileTint(colorAdjust, neutralTint) ?? neutralTint
      : tileColor
        ? OFFICE_TILE_COLOR_TINTS[tileColor] ?? neutralTint
        : neutralTint;
    const pattern = floorPattern ?? "environment.floors.pattern-01";
    if (
      tile.kind === "floor" &&
      tile.tint === tint &&
      tile.pattern === pattern &&
      officeColorAdjustEquals(tile.colorAdjust ?? null, colorAdjust)
    ) {
      return false;
    }
    tile.kind = "floor";
    tile.tint = tint;
    tile.pattern = pattern;
    tile.colorAdjust = colorAdjust;
    return true;
  }

  private applyWall(layout: OfficeSceneLayout, idx: number): boolean {
    const tile = layout.tiles[idx];
    if (!tile) return false;
    if (tile.kind === "wall") return false;
    tile.kind = "wall";
    delete tile.tint;
    delete tile.colorAdjust;
    return true;
  }

  private applyErase(layout: OfficeSceneLayout, idx: number, cell: OfficeCellCoord): boolean {
    const tile = layout.tiles[idx];
    const furnitureAtCell = layout.furniture.filter(
      (f) => cell.col >= f.col && cell.col < f.col + f.width &&
             cell.row >= f.row && cell.row < f.row + f.height,
    );
    if ((tile?.kind === "void" || !tile) && furnitureAtCell.length === 0) return false;
    if (tile) {
      tile.kind = "void";
      delete tile.tint;
      delete tile.colorAdjust;
    }
    if (furnitureAtCell.length > 0) {
      const removeIds = new Set(furnitureAtCell.map((f) => f.id));
      layout.furniture = layout.furniture.filter((f) => !removeIds.has(f.id));
    }
    return true;
  }

  private applyFurniture(
    layout: OfficeSceneLayout,
    cell: OfficeCellCoord,
    furnitureId: string | null,
  ): boolean {
    if (!furnitureId) return false;
    const paletteItem = FURNITURE_PALETTE_ITEMS.find((item) => item.id === furnitureId);
    if (!paletteItem) return false;

    if (cell.col + paletteItem.footprintW > layout.cols || cell.row + paletteItem.footprintH > layout.rows) {
      return false;
    }

    // Remove existing furniture that overlaps the new placement footprint.
    const newRight = cell.col + paletteItem.footprintW;
    const newBottom = cell.row + paletteItem.footprintH;
    layout.furniture = layout.furniture.filter(
      (f) => f.col >= newRight || f.col + f.width <= cell.col ||
             f.row >= newBottom || f.row + f.height <= cell.row,
    );

    const newFurniture: OfficeSceneFurniture = {
      id: `placed-${furnitureId}-${nextFurniturePlacementId++}`,
      assetId: furnitureId,
      label: paletteItem.label,
      category: paletteItem.category as OfficeSceneFurnitureCategory,
      placement: paletteItem.placement,
      col: cell.col,
      row: cell.row,
      width: paletteItem.footprintW,
      height: paletteItem.footprintH,
      color: paletteItem.color,
      accentColor: paletteItem.accentColor,
    };

    layout.furniture.push(newFurniture);
    return true;
  }
}
