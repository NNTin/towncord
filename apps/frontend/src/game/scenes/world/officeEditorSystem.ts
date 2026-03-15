import type { OfficeCellCoord } from "../../town/layout";
import type { OfficeSceneFurniture, OfficeSceneFurnitureCategory, OfficeSceneLayout } from "../office/bootstrap";
import { OFFICE_TILE_COLOR_TINTS } from "../office/colors";
import { FURNITURE_PALETTE_ITEMS } from "../../office/officeFurniturePalette";
import type { OfficeEditorToolId } from "../../events";

// Monotonic counter for unique furniture placement IDs. Module-level so it
// survives re-instantiation of OfficeEditorSystem across re-renders.
let nextFurniturePlacementId = 1;

type OfficeEditorCommand = {
  tool: OfficeEditorToolId;
  cell: OfficeCellCoord;
  /** Active tile-color key (only used by the "floor" tool). */
  tileColor: string;
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
        return this.applyFloor(layout, idx, command.tileColor);

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

  private applyFloor(layout: OfficeSceneLayout, idx: number, tileColor: string): boolean {
    const tile = layout.tiles[idx];
    if (!tile) return false;
    const tint = OFFICE_TILE_COLOR_TINTS[tileColor] ?? OFFICE_TILE_COLOR_TINTS.neutral ?? 0x475569;
    if (tile.kind === "floor" && tile.tint === tint) return false;
    tile.kind = "floor";
    tile.tint = tint;
    return true;
  }

  private applyWall(layout: OfficeSceneLayout, idx: number): boolean {
    const tile = layout.tiles[idx];
    if (!tile) return false;
    if (tile.kind === "wall") return false;
    tile.kind = "wall";
    delete tile.tint;
    return true;
  }

  private applyErase(layout: OfficeSceneLayout, idx: number, cell: OfficeCellCoord): boolean {
    const tile = layout.tiles[idx];
    const furnitureAtCell = layout.furniture.filter(
      (f) => cell.col >= f.col && cell.col < f.col + f.width &&
             cell.row >= f.row && cell.row < f.row + f.height,
    );
    if ((tile?.kind === "void" || !tile) && furnitureAtCell.length === 0) return false;
    if (tile) { tile.kind = "void"; delete tile.tint; }
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
