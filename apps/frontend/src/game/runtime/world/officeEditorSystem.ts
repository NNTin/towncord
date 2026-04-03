import { type AnchoredGridCellCoord as OfficeCellCoord } from "../../../engine/world-runtime/regions";
import { shouldTreatFurnitureOverlapAsExclusive } from "../../../engine/world-runtime/spatial";
import {
  officeColorAdjustEquals,
  resolveOfficeFloorAppearance,
  resolveOfficeWallAppearance,
  type OfficeColorAdjust,
} from "../../content/structures/colors";
import {
  FURNITURE_ALL_ITEMS,
  FURNITURE_ATLAS_TEXTURE_KEY,
  canRotateFurniturePaletteItem,
  resolveFurnitureRotationVariant,
  type FurniturePaletteItem,
  type FurnitureRotationQuarterTurns,
} from "../../content/structures/furniturePalette";
import { type PropPaletteItem } from "../../content/structures/propPalette";
import type {
  OfficeSceneFurniture,
  OfficeSceneFurnitureCategory,
  OfficeSceneFurnitureRenderAsset,
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
  /** Raw wall color-adjust data (only used by the "wall" tool when provided). */
  wallColor: OfficeColorAdjust | null;
  /** Active floor pattern ID (only used by the "floor" tool), e.g. "environment.floors.pattern-02". */
  floorPattern: string | null;
  /** Active furniture asset ID (only used by the "furniture" tool). */
  furnitureId: string | null;
  /** Pending clockwise quarter-turns from the selected furniture tool. */
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
};

type OfficePlaceablePaletteItem = Pick<
  FurniturePaletteItem,
  | "id"
  | "label"
  | "category"
  | "placement"
  | "textureKey"
  | "atlasKey"
  | "atlasFrame"
  | "footprintW"
  | "footprintH"
  | "color"
  | "accentColor"
  | "groupId"
  | "orientation"
  | "state"
> &
  Partial<Pick<PropPaletteItem, "groupLabel">>;

export type OfficeFurniturePlacementPreview = {
  kind: "place" | "replace" | "blocked";
  anchorCell: OfficeCellCoord;
  asset: OfficePlaceablePaletteItem;
  footprintW: number;
  footprintH: number;
  affectedFurniture: OfficeSceneFurniture[];
  blockedReason: "out-of-bounds" | "occupied" | null;
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
        return this.applyWall(layout, idx, command.wallColor);

      case "erase":
        return this.applyErase(layout, idx, cell);

      case "furniture":
        return this.applyFurniture(
          layout,
          cell,
          command.furnitureId,
          command.rotationQuarterTurns,
        );

      case "prop":
        return false;
    }

    return false;
  }

  public removeFurniture(
    layout: OfficeSceneLayout,
    furnitureId: string,
  ): boolean {
    const nextFurniture = layout.furniture.filter(
      (furniture) => furniture.id !== furnitureId,
    );
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
    assetId: string | null,
    rotationQuarterTurns: FurnitureRotationQuarterTurns,
  ): OfficeFurniturePlacementPreview | null {
    const asset = this.resolvePlacementFurnitureAsset(
      assetId,
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
        ? this.findExclusiveOverlappingFurniture(layout, {
            category: asset.category,
            col: cell.col,
            row: cell.row,
            width: asset.footprintW,
            height: asset.footprintH,
          })
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

  public canRotateFurniture(
    layout: OfficeSceneLayout,
    furnitureId: string,
  ): boolean {
    const current = layout.furniture.find(
      (furniture) => furniture.id === furnitureId,
    );
    if (!current) {
      return false;
    }

    const currentAsset = FURNITURE_ALL_ITEMS.find(
      (item) => item.id === current.assetId,
    );
    const nextAsset = this.resolveRotatedFurnitureAsset(currentAsset);
    if (!nextAsset || !currentAsset || nextAsset.id === currentAsset.id) {
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
        textureKey: nextAsset.textureKey,
        atlasKey: nextAsset.atlasKey,
        atlasFrame: { ...nextAsset.atlasFrame },
      },
    };

    const blockedFurniture = this.findBlockingOverlappingFurniture(
      layout,
      {
        category: rotatedFurniture.category,
        col: rotatedFurniture.col,
        row: rotatedFurniture.row,
        width: rotatedFurniture.width,
        height: rotatedFurniture.height,
      },
      furnitureId,
    );

    return blockedFurniture.length === 0;
  }

  public canRotatePlacementFurniture(furnitureId: string | null): boolean {
    return canRotateFurniturePaletteItem(furnitureId);
  }

  public rotateFurniture(
    layout: OfficeSceneLayout,
    furnitureId: string,
  ): boolean {
    const index = layout.furniture.findIndex(
      (furniture) => furniture.id === furnitureId,
    );
    if (index < 0) {
      return false;
    }

    const current = layout.furniture[index];
    if (!current) {
      return false;
    }

    const currentAsset = FURNITURE_ALL_ITEMS.find(
      (item) => item.id === current.assetId,
    );
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
        textureKey: nextAsset.textureKey,
        atlasKey: nextAsset.atlasKey,
        atlasFrame: { ...nextAsset.atlasFrame },
      },
    };

    const blockedFurniture = this.findBlockingOverlappingFurniture(
      layout,
      {
        category: rotatedFurniture.category,
        col: rotatedFurniture.col,
        row: rotatedFurniture.row,
        width: rotatedFurniture.width,
        height: rotatedFurniture.height,
      },
      furnitureId,
    );
    if (blockedFurniture.length > 0) {
      return false;
    }

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

  private applyWall(
    layout: OfficeSceneLayout,
    idx: number,
    wallColor: OfficeColorAdjust | null,
  ): boolean {
    const tile = layout.tiles[idx];
    if (!tile) {
      return false;
    }

    const { colorAdjust, tint } = resolveOfficeWallAppearance(wallColor);
    if (
      tile.kind === "wall" &&
      tile.tileId === 8 &&
      tile.tint === tint &&
      officeColorAdjustEquals(tile.colorAdjust ?? null, colorAdjust)
    ) {
      return false;
    }

    tile.kind = "wall";
    tile.tileId = 8;
    tile.tint = tint;
    tile.colorAdjust = colorAdjust;
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
    return this.placePaletteItem(layout, cell, paletteItem);
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

  public previewFurnitureMove(
    layout: OfficeSceneLayout,
    furnitureId: string,
    targetCell: OfficeCellCoord,
  ): OfficeFurniturePlacementPreview | null {
    const furniture = layout.furniture.find((f) => f.id === furnitureId);
    if (!furniture) {
      return null;
    }

    const asset =
      this.resolvePlacedFurniturePreviewAsset(furniture) ??
      FURNITURE_ALL_ITEMS.find((item) => item.id === furniture.assetId);
    if (!asset) {
      return null;
    }

    if (furniture.col === targetCell.col && furniture.row === targetCell.row) {
      return null;
    }

    const blockedReason: "out-of-bounds" | null =
      targetCell.col < 0 ||
      targetCell.row < 0 ||
      targetCell.col + furniture.width > layout.cols ||
      targetCell.row + furniture.height > layout.rows
        ? "out-of-bounds"
        : null;

    const affectedFurniture =
      blockedReason === null
        ? this.findBlockingOverlappingFurniture(
            layout,
            {
              category: furniture.category,
              col: targetCell.col,
              row: targetCell.row,
              width: furniture.width,
              height: furniture.height,
            },
            furnitureId,
          )
        : [];
    const moveBlockedReason =
      blockedReason ?? (affectedFurniture.length > 0 ? "occupied" : null);

    return {
      kind: moveBlockedReason !== null ? "blocked" : "place",
      anchorCell: targetCell,
      asset,
      footprintW: furniture.width,
      footprintH: furniture.height,
      affectedFurniture,
      blockedReason: moveBlockedReason,
    };
  }

  private placePaletteItem(
    layout: OfficeSceneLayout,
    cell: OfficeCellCoord,
    paletteItem: OfficePlaceablePaletteItem,
  ): boolean {
    if (
      cell.col + paletteItem.footprintW > layout.cols ||
      cell.row + paletteItem.footprintH > layout.rows
    ) {
      return false;
    }

    const overlappingFurniture = this.findExclusiveOverlappingFurniture(
      layout,
      {
        category: paletteItem.category,
        col: cell.col,
        row: cell.row,
        width: paletteItem.footprintW,
        height: paletteItem.footprintH,
      },
    );
    if (overlappingFurniture.length > 0) {
      const removeIds = new Set(
        overlappingFurniture.map((furniture) => furniture.id),
      );
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
      ...(paletteItem.orientation
        ? { orientation: paletteItem.orientation }
        : {}),
      ...(paletteItem.state ? { state: paletteItem.state } : {}),
      renderAsset: {
        textureKey: paletteItem.textureKey,
        atlasKey: paletteItem.atlasKey,
        atlasFrame: { ...paletteItem.atlasFrame },
      },
    };

    layout.furniture.push(newFurniture);
    return true;
  }

  private resolvePlacedFurniturePreviewAsset(
    furniture: OfficeSceneFurniture,
  ): OfficePlaceablePaletteItem | null {
    const renderAsset = furniture.renderAsset;
    if (!renderAsset) {
      return null;
    }

    return {
      id: furniture.assetId,
      label: furniture.label,
      category: furniture.category,
      placement: furniture.placement,
      textureKey: renderAsset.textureKey ?? FURNITURE_ATLAS_TEXTURE_KEY,
      atlasKey: renderAsset.atlasKey,
      atlasFrame: { ...renderAsset.atlasFrame },
      footprintW: furniture.width,
      footprintH: furniture.height,
      color: furniture.color,
      accentColor: furniture.accentColor,
    };
  }

  public moveFurniture(
    layout: OfficeSceneLayout,
    furnitureId: string,
    targetCell: OfficeCellCoord,
  ): boolean {
    const index = layout.furniture.findIndex((f) => f.id === furnitureId);
    if (index < 0) {
      return false;
    }

    const furniture = layout.furniture[index];
    if (!furniture) {
      return false;
    }

    if (furniture.col === targetCell.col && furniture.row === targetCell.row) {
      return false;
    }

    if (
      targetCell.col < 0 ||
      targetCell.row < 0 ||
      targetCell.col + furniture.width > layout.cols ||
      targetCell.row + furniture.height > layout.rows
    ) {
      return false;
    }

    const overlapping = this.findBlockingOverlappingFurniture(
      layout,
      {
        category: furniture.category,
        col: targetCell.col,
        row: targetCell.row,
        width: furniture.width,
        height: furniture.height,
      },
      furnitureId,
    );

    if (overlapping.length > 0) {
      return false;
    }

    furniture.col = targetCell.col;
    furniture.row = targetCell.row;
    return true;
  }

  private findOverlappingFurniture(
    layout: OfficeSceneLayout,
    bounds: { col: number; row: number; width: number; height: number },
  ): OfficeSceneFurniture[] {
    const newRight = bounds.col + bounds.width;
    const newBottom = bounds.row + bounds.height;

    return layout.furniture.filter(
      (furniture) =>
        !(
          furniture.col >= newRight ||
          furniture.col + furniture.width <= bounds.col ||
          furniture.row >= newBottom ||
          furniture.row + furniture.height <= bounds.row
        ),
    );
  }

  private findExclusiveOverlappingFurniture(
    layout: OfficeSceneLayout,
    bounds: {
      category: string;
      col: number;
      row: number;
      width: number;
      height: number;
    },
  ): OfficeSceneFurniture[] {
    return this.findOverlappingFurniture(layout, bounds).filter((furniture) =>
      shouldTreatFurnitureOverlapAsExclusive(
        bounds.category,
        furniture.category,
      ),
    );
  }

  private findBlockingOverlappingFurniture(
    layout: OfficeSceneLayout,
    bounds: {
      category: string;
      col: number;
      row: number;
      width: number;
      height: number;
    },
    ignoreFurnitureId?: string,
  ): OfficeSceneFurniture[] {
    return this.findOverlappingFurniture(layout, bounds)
      .filter((furniture) => furniture.id !== ignoreFurnitureId)
      .filter((furniture) =>
        shouldTreatFurnitureOverlapAsExclusive(
          bounds.category,
          furniture.category,
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
    const currentIndex = ROTATION_ORDER.indexOf(
      currentAsset.orientation as (typeof ROTATION_ORDER)[number],
    );
    if (currentIndex < 0) {
      return null;
    }

    for (let offset = 1; offset <= ROTATION_ORDER.length; offset += 1) {
      const nextOrientation =
        ROTATION_ORDER[(currentIndex + offset) % ROTATION_ORDER.length];
      const nextAsset =
        candidates.find(
          (item) =>
            item.orientation === nextOrientation &&
            (item.state ?? null) === currentState,
        ) ?? candidates.find((item) => item.orientation === nextOrientation);

      if (nextAsset) {
        return nextAsset;
      }
    }

    return null;
  }
}
