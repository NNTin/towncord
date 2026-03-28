import type { AnchoredGridCellCoord as OfficeCellCoord } from "../../../engine/world-runtime/regions";
import {
  officeColorAdjustEquals,
  resolveOfficeFloorAppearance,
  type OfficeColorAdjust,
} from "../../content/structures/colors";
import {
  FURNITURE_ALL_ITEMS,
  canRotateFurniturePaletteItem,
  resolveFurnitureRotationVariant,
  type FurniturePaletteItem,
  type FurnitureRotationQuarterTurns,
} from "../../content/structures/furniturePalette";
import type {
  OfficeSceneFurniture,
  OfficeSceneFurnitureCategory,
  OfficeSceneLayout,
} from "../../officeLayoutContract";
import type { OfficeTileColor } from "../../world/structures/model";
import type { OfficeEditorToolId } from "../../contracts/office-editor";

// Monotonic counter for unique furniture placement IDs. Module-level so it
// survives re-instantiation of OfficeEditorSystem across re-renders.
let nextFurniturePlacementId = 1;
const ROTATION_ORDER = ["front", "right", "back", "left"] as const;

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
  /** Pending clockwise quarter-turns from the selected furniture tool. */
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
};

export type OfficeFurniturePlacementPreview = {
  kind: "place" | "replace" | "blocked";
  anchorCell: OfficeCellCoord;
  asset: FurniturePaletteItem;
  footprintW: number;
  footprintH: number;
  affectedFurniture: OfficeSceneFurniture[];
  blockedReason: "out-of-bounds" | null;
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
  applyCommand(
    layout: OfficeSceneLayout,
    command: OfficeEditorCommand,
  ): boolean {
    const { tool, cell } = command;
    const idx = cell.row * layout.cols + cell.col;

    switch (tool) {
      case "floor":
        return this.applyFloor(
          layout,
          idx,
          command.tileColor,
          command.floorColor,
          command.floorPattern,
        );

      case "wall":
        return this.applyWall(layout, idx);

      case "erase":
        return this.applyErase(layout, idx, cell);

      case "furniture":
        return this.applyFurniture(
          layout,
          cell,
          command.furnitureId,
          command.rotationQuarterTurns,
        );
    }

    return false;
  }

  public removeFurniture(layout: OfficeSceneLayout, furnitureId: string): boolean {
    const nextFurniture = layout.furniture.filter((furniture) => furniture.id !== furnitureId);
    if (nextFurniture.length === layout.furniture.length) {
      return false;
    }

    layout.furniture = nextFurniture;
    return true;
  }

  public removeWall(layout: OfficeSceneLayout, cell: OfficeCellCoord): boolean {
    const idx = cell.row * layout.cols + cell.col;
    const tile = layout.tiles[idx];
    if (!tile || tile.kind !== "wall") {
      return false;
    }

    tile.kind = "void";
    tile.tileId = 0;
    delete tile.tint;
    delete tile.colorAdjust;
    delete tile.pattern;
    return true;
  }

  public previewFurniturePlacement(
    layout: OfficeSceneLayout,
    cell: OfficeCellCoord,
    furnitureId: string | null,
    rotationQuarterTurns: FurnitureRotationQuarterTurns,
  ): OfficeFurniturePlacementPreview | null {
    const asset = this.resolvePlacementFurnitureAsset(
      furnitureId,
      rotationQuarterTurns,
    );
    if (!asset) {
      return null;
    }

    const blockedReason =
      cell.col + asset.footprintW > layout.cols ||
      cell.row + asset.footprintH > layout.rows
        ? "out-of-bounds"
        : null;
    const affectedFurniture =
      blockedReason === null
        ? this.findOverlappingFurniture(layout, cell, asset.footprintW, asset.footprintH)
        : [];

    return {
      kind:
        blockedReason !== null
          ? "blocked"
          : affectedFurniture.length > 0
            ? "replace"
            : "place",
      anchorCell: cell,
      asset,
      footprintW: asset.footprintW,
      footprintH: asset.footprintH,
      affectedFurniture,
      blockedReason,
    };
  }

  public canRotateFurniture(layout: OfficeSceneLayout, furnitureId: string): boolean {
    const current = layout.furniture.find((furniture) => furniture.id === furnitureId);
    if (!current) {
      return false;
    }

    const currentAsset = FURNITURE_ALL_ITEMS.find((item) => item.id === current.assetId);
    const nextAsset = this.resolveRotatedFurnitureAsset(currentAsset);
    return Boolean(nextAsset && currentAsset && nextAsset.id !== currentAsset.id);
  }

  public canRotatePlacementFurniture(furnitureId: string | null): boolean {
    return canRotateFurniturePaletteItem(furnitureId);
  }

  public rotateFurniture(layout: OfficeSceneLayout, furnitureId: string): boolean {
    const index = layout.furniture.findIndex((furniture) => furniture.id === furnitureId);
    if (index < 0) {
      return false;
    }

    const current = layout.furniture[index];
    if (!current) {
      return false;
    }

    const currentAsset = FURNITURE_ALL_ITEMS.find((item) => item.id === current.assetId);
    const nextAsset = this.resolveRotatedFurnitureAsset(currentAsset);
    if (!currentAsset || !nextAsset || nextAsset.id === currentAsset.id) {
      return false;
    }

    const rotatedFurniture: OfficeSceneFurniture = {
      ...current,
      assetId: nextAsset.id,
      label: nextAsset.label,
      category: nextAsset.category as OfficeSceneFurnitureCategory,
      placement: nextAsset.placement,
      width: nextAsset.footprintW,
      height: nextAsset.footprintH,
      color: nextAsset.color,
      accentColor: nextAsset.accentColor,
      ...(nextAsset.groupId ? { groupId: nextAsset.groupId } : {}),
      ...(nextAsset.orientation ? { orientation: nextAsset.orientation } : {}),
      ...(nextAsset.state ? { state: nextAsset.state } : {}),
      renderAsset: {
        atlasKey: nextAsset.atlasKey,
        atlasFrame: { ...nextAsset.atlasFrame },
      },
    };
    layout.furniture[index] = rotatedFurniture;
    return true;
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
    const { colorAdjust, tint } = resolveOfficeFloorAppearance(
      floorColor,
      tileColor,
    );
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
    const hasFloorMetadata =
      typeof tile.tint === "number" ||
      tile.colorAdjust != null ||
      typeof tile.pattern === "string";
    if (tile.kind === "wall" && !hasFloorMetadata) return false;
    tile.kind = "wall";
    delete tile.tint;
    delete tile.colorAdjust;
    delete tile.pattern;
    return true;
  }

  private applyErase(
    layout: OfficeSceneLayout,
    idx: number,
    cell: OfficeCellCoord,
  ): boolean {
    const tile = layout.tiles[idx];
    const furnitureAtCell = layout.furniture.filter(
      (f) =>
        cell.col >= f.col &&
        cell.col < f.col + f.width &&
        cell.row >= f.row &&
        cell.row < f.row + f.height,
    );
    const tileNeedsClear =
      !!tile &&
      (tile.kind !== "void" ||
        typeof tile.tint === "number" ||
        tile.colorAdjust != null ||
        typeof tile.pattern === "string");
    if (!tileNeedsClear && furnitureAtCell.length === 0) return false;
    if (tile) {
      tile.kind = "void";
      delete tile.tint;
      delete tile.colorAdjust;
      delete tile.pattern;
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
    rotationQuarterTurns: FurnitureRotationQuarterTurns,
  ): boolean {
    const paletteItem = this.resolvePlacementFurnitureAsset(
      furnitureId,
      rotationQuarterTurns,
    );
    if (!paletteItem) return false;

    if (
      cell.col + paletteItem.footprintW > layout.cols ||
      cell.row + paletteItem.footprintH > layout.rows
    ) {
      return false;
    }

    // Remove existing furniture that overlaps the new placement footprint.
    const overlappingFurniture = this.findOverlappingFurniture(
      layout,
      cell,
      paletteItem.footprintW,
      paletteItem.footprintH,
    );
    if (overlappingFurniture.length > 0) {
      const removeIds = new Set(overlappingFurniture.map((furniture) => furniture.id));
      layout.furniture = layout.furniture.filter(
        (furniture) => !removeIds.has(furniture.id),
      );
    }

    const newFurniture: OfficeSceneFurniture = {
      id: `placed-${paletteItem.id}-${nextFurniturePlacementId++}`,
      assetId: paletteItem.id,
      label: paletteItem.label,
      category: paletteItem.category as OfficeSceneFurnitureCategory,
      placement: paletteItem.placement,
      col: cell.col,
      row: cell.row,
      width: paletteItem.footprintW,
      height: paletteItem.footprintH,
      color: paletteItem.color,
      accentColor: paletteItem.accentColor,
      ...(paletteItem.groupId ? { groupId: paletteItem.groupId } : {}),
      ...(paletteItem.orientation ? { orientation: paletteItem.orientation } : {}),
      ...(paletteItem.state ? { state: paletteItem.state } : {}),
      renderAsset: {
        atlasKey: paletteItem.atlasKey,
        atlasFrame: { ...paletteItem.atlasFrame },
      },
    };

    layout.furniture.push(newFurniture);
    return true;
  }

  private resolvePlacementFurnitureAsset(
    furnitureId: string | null,
    rotationQuarterTurns: FurnitureRotationQuarterTurns,
  ): FurniturePaletteItem | null {
    if (!furnitureId) {
      return null;
    }

    return resolveFurnitureRotationVariant(furnitureId, rotationQuarterTurns);
  }

  private findOverlappingFurniture(
    layout: OfficeSceneLayout,
    cell: OfficeCellCoord,
    width: number,
    height: number,
  ): OfficeSceneFurniture[] {
    const newRight = cell.col + width;
    const newBottom = cell.row + height;

    return layout.furniture.filter(
      (furniture) =>
        !(
          furniture.col >= newRight ||
          furniture.col + furniture.width <= cell.col ||
          furniture.row >= newBottom ||
          furniture.row + furniture.height <= cell.row
        ),
    );
  }

  private resolveRotatedFurnitureAsset(
    currentAsset: (typeof FURNITURE_ALL_ITEMS)[number] | undefined,
  ): (typeof FURNITURE_ALL_ITEMS)[number] | null {
    if (!currentAsset?.groupId || !currentAsset.orientation) {
      return null;
    }

    const candidates = FURNITURE_ALL_ITEMS.filter(
      (item) => item.groupId === currentAsset.groupId,
    );
    if (candidates.length < 2) {
      return null;
    }

    const currentState = currentAsset.state ?? null;
    const currentIndex = ROTATION_ORDER.indexOf(currentAsset.orientation as (typeof ROTATION_ORDER)[number]);
    if (currentIndex < 0) {
      return null;
    }

    for (let offset = 1; offset <= ROTATION_ORDER.length; offset += 1) {
      const nextOrientation = ROTATION_ORDER[(currentIndex + offset) % ROTATION_ORDER.length];
      const nextAsset =
        candidates.find(
          (item) =>
            item.orientation === nextOrientation &&
            (item.state ?? null) === currentState,
        ) ??
        candidates.find((item) => item.orientation === nextOrientation);

      if (nextAsset) {
        return nextAsset;
      }
    }

    return null;
  }
}
