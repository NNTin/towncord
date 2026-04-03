import type Phaser from "phaser";
import type {
  OfficeSetEditorToolPayload,
  OfficeSetEditorToolPropPayload,
} from "../../contracts/office-editor";
import type { OfficeSceneLayout } from "../../contracts/office-scene";
import { TERRAIN_CELL_WORLD_SIZE, type TerrainRuntime } from "../../../engine";
import {
  worldToAnchoredGridCell,
  type AnchoredGridRegion,
} from "../../../engine/world-runtime/regions";
import {
  resolvePropPaletteItem,
  type PropPaletteItem,
} from "../../content/structures/propPalette";
import { RENDER_LAYERS } from "../../renderLayers";
import type { EntityRegistry } from "../../world/entities/entityRegistry";
import type { EntitySystem } from "./entitySystem";
import type { WorldEntity } from "./types";

type OfficeRegion = AnchoredGridRegion<OfficeSceneLayout>;

type WorldSceneTerrainPropControllerHost = {
  scene: Pick<Phaser.Scene, "add" | "cameras" | "input">;
  getTerrainRuntime: () => TerrainRuntime | null;
  getOfficeRegion: () => OfficeRegion | null;
  getEntityRegistry: () => EntityRegistry | null;
  getEntitySystem: () => EntitySystem | null;
  selectEntity: (entity: WorldEntity | null) => void;
  getWorldPoint: (
    screenX: number,
    screenY: number,
  ) => {
    x: number;
    y: number;
  };
};

type TerrainPropPlacementPreview = {
  kind: "place" | "replace" | "blocked";
  anchorCell: { cellX: number; cellY: number };
  asset: PropPaletteItem;
  footprintW: number;
  footprintH: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  affectedProps: WorldEntity[];
  blockedReason: "out-of-bounds" | "occupied" | null;
};

const TERRAIN_PROP_PREVIEW_GHOST_ALPHA = 0.58;
const TERRAIN_PROP_PREVIEW_PLACE_FILL = 0x38bdf8;
const TERRAIN_PROP_PREVIEW_PLACE_STROKE = 0xe0f2fe;
const TERRAIN_PROP_PREVIEW_REPLACE_FILL = 0xf59e0b;
const TERRAIN_PROP_PREVIEW_REPLACE_STROKE = 0xfcd34d;
const TERRAIN_PROP_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_PROP_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_PROP_PREVIEW_FOOTPRINT_ALPHA = 0.18;
const TERRAIN_PROP_PREVIEW_FOOTPRINT_STROKE_WIDTH = 2;
const TERRAIN_PROP_PREVIEW_FOOTPRINT_DEPTH =
  RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 2;
const TERRAIN_PROP_PREVIEW_GHOST_DEPTH =
  RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 3;
const TERRAIN_PROP_PREVIEW_LABEL_DEPTH =
  RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 4;

function isPointerWithinGame(pointer: Phaser.Input.Pointer | null): boolean {
  if (!pointer) {
    return false;
  }

  return (
    !("withinGame" in pointer) ||
    Boolean(
      (pointer as Phaser.Input.Pointer & { withinGame?: boolean }).withinGame,
    )
  );
}

function resolveTerrainPropFootprint(
  asset: PropPaletteItem,
  rotationQuarterTurns: 0 | 1 | 2 | 3,
): { footprintW: number; footprintH: number } {
  return rotationQuarterTurns % 2 === 0
    ? { footprintW: asset.footprintW, footprintH: asset.footprintH }
    : { footprintW: asset.footprintH, footprintH: asset.footprintW };
}

function isCellWithinOfficeRegion(
  officeRegion: OfficeRegion | null,
  worldX: number,
  worldY: number,
): boolean {
  if (!officeRegion) {
    return false;
  }

  return Boolean(worldToAnchoredGridCell(worldX, worldY, officeRegion));
}

function getTerrainPropPlacementCells(
  anchorCell: { cellX: number; cellY: number },
  footprintW: number,
  footprintH: number,
): Array<{ cellX: number; cellY: number }> {
  const cells: Array<{ cellX: number; cellY: number }> = [];

  for (let rowOffset = 0; rowOffset < footprintH; rowOffset += 1) {
    for (let colOffset = 0; colOffset < footprintW; colOffset += 1) {
      cells.push({
        cellX: anchorCell.cellX + colOffset,
        cellY: anchorCell.cellY + rowOffset,
      });
    }
  }

  return cells;
}

function isWorldEntityOccupyingCell(
  entity: WorldEntity,
  cellX: number,
  cellY: number,
  grid: ReturnType<TerrainRuntime["getGameplayGrid"]>,
): boolean {
  const placement = entity.terrainPropPlacement;
  if (entity.definition.kind === "prop" && placement) {
    return getTerrainPropPlacementCells(
      placement.anchorCell,
      placement.footprintW,
      placement.footprintH,
    ).some(
      (candidate) => candidate.cellX === cellX && candidate.cellY === cellY,
    );
  }

  const worldCell = grid.worldToCell(entity.position.x, entity.position.y);
  return worldCell?.cellX === cellX && worldCell?.cellY === cellY;
}

export class WorldSceneTerrainPropController {
  private activeTool: OfficeSetEditorToolPropPayload | null = null;
  private previewGhost: Phaser.GameObjects.Image | null = null;
  private previewCells: Phaser.GameObjects.Rectangle[] = [];
  private previewLabel: Phaser.GameObjects.Text | null = null;

  constructor(private readonly host: WorldSceneTerrainPropControllerHost) {}

  public hasActiveTool(): boolean {
    return Boolean(this.activeTool?.tool === "prop" && this.activeTool.propId);
  }

  public reset(): void {
    this.activeTool = null;
    this.hidePreview();
  }

  public setTerrainPropTool(payload: OfficeSetEditorToolPayload): void {
    this.activeTool =
      payload.tool === "prop"
        ? {
            tool: "prop",
            propId: payload.propId,
            rotationQuarterTurns: payload.rotationQuarterTurns,
          }
        : null;
    this.syncPreview(this.host.scene.input.activePointer);
  }

  public tryHandlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    const tool = this.activeTool;
    if (!tool || !tool.propId) {
      return false;
    }

    if (!isPointerWithinGame(pointer)) {
      return true;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const officeRegion = this.host.getOfficeRegion();
    if (isCellWithinOfficeRegion(officeRegion, worldPoint.x, worldPoint.y)) {
      return true;
    }

    const entitySystem = this.host.getEntitySystem();
    const terrainRuntime = this.host.getTerrainRuntime();
    const asset = resolvePropPaletteItem(tool.propId);
    if (!entitySystem || !terrainRuntime || !asset) {
      return false;
    }

    const grid = terrainRuntime.getGameplayGrid();
    const cell = grid.worldToCell(worldPoint.x, worldPoint.y);
    if (!cell) {
      return true;
    }

    const preview = this.previewForPlacement(tool, asset, cell);
    if (preview.kind === "blocked") {
      return true;
    }

    if (preview.affectedProps.length > 0) {
      for (const prop of preview.affectedProps) {
        entitySystem.removeEntity(prop);
      }
    }

    const worldCenter = grid.cellToWorldCenter(
      preview.anchorCell.cellX,
      preview.anchorCell.cellY,
    );
    if (!worldCenter) {
      return true;
    }

    const runtime = this.host.getEntityRegistry()?.getRuntimeById(asset.id);
    if (!runtime) {
      return false;
    }
    const placed = entitySystem.addEntity(
      runtime,
      worldCenter.worldX,
      worldCenter.worldY,
      {
        rotationQuarterTurns: tool.rotationQuarterTurns,
        terrainPropPlacement: {
          anchorCell: preview.anchorCell,
          footprintW: preview.footprintW,
          footprintH: preview.footprintH,
          rotationQuarterTurns: tool.rotationQuarterTurns,
        },
      },
    );
    if (!placed) {
      return true;
    }

    this.host.selectEntity(placed);
    return true;
  }

  public rotateSelectedProp(): boolean {
    const entitySystem = this.host.getEntitySystem();
    const terrainRuntime = this.host.getTerrainRuntime();
    const selected = entitySystem?.getSelected() ?? null;
    if (!entitySystem || !terrainRuntime || !selected) {
      return false;
    }

    const placement = selected.terrainPropPlacement;
    const asset = resolvePropPaletteItem(selected.definition.id);
    if (selected.definition.kind !== "prop" || !placement || !asset) {
      return false;
    }

    const nextRotation = ((placement.rotationQuarterTurns + 1) % 4) as
      | 0
      | 1
      | 2
      | 3;
    const preview = this.previewForRotation(selected, asset, nextRotation);
    if (preview.kind === "blocked") {
      return false;
    }

    placement.rotationQuarterTurns = nextRotation;
    placement.footprintW = preview.footprintW;
    placement.footprintH = preview.footprintH;
    selected.rotationQuarterTurns = nextRotation;
    selected.sprite.setRotation((Math.PI / 2) * nextRotation);
    return true;
  }

  public deleteSelectedProp(): boolean {
    const entitySystem = this.host.getEntitySystem();
    const selected = entitySystem?.getSelected() ?? null;
    if (!entitySystem || !selected || selected.definition.kind !== "prop") {
      return false;
    }

    const removed = entitySystem.removeEntity(selected);
    if (removed) {
      this.host.selectEntity(null);
    }
    return removed;
  }

  public syncPreview(pointer: Phaser.Input.Pointer | null): void {
    const tool = this.activeTool;
    const terrainRuntime = this.host.getTerrainRuntime();
    const asset = tool?.propId ? resolvePropPaletteItem(tool.propId) : null;
    if (!tool || !tool.propId || !terrainRuntime || !asset || !pointer) {
      this.hidePreview();
      return;
    }

    if (!isPointerWithinGame(pointer)) {
      this.hidePreview();
      return;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const officeRegion = this.host.getOfficeRegion();
    if (isCellWithinOfficeRegion(officeRegion, worldPoint.x, worldPoint.y)) {
      this.hidePreview();
      return;
    }

    const grid = terrainRuntime.getGameplayGrid();
    const cell = grid.worldToCell(worldPoint.x, worldPoint.y);
    if (!cell) {
      this.hidePreview();
      return;
    }

    const preview = this.previewForPlacement(tool, asset, cell);
    this.renderPreview(preview, grid);
  }

  public dispose(): void {
    this.hidePreview();
    this.activeTool = null;
  }

  private previewForRotation(
    selected: WorldEntity,
    asset: PropPaletteItem,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
  ): TerrainPropPlacementPreview {
    const placement = selected.terrainPropPlacement;
    if (!placement) {
      return {
        kind: "blocked",
        anchorCell: { cellX: 0, cellY: 0 },
        asset,
        footprintW: asset.footprintW,
        footprintH: asset.footprintH,
        rotationQuarterTurns,
        affectedProps: [],
        blockedReason: "occupied",
      };
    }

    const { footprintW, footprintH } = resolveTerrainPropFootprint(
      asset,
      rotationQuarterTurns,
    );
    const anchorCell = placement.anchorCell;
    const grid = this.host.getTerrainRuntime()?.getGameplayGrid();
    if (!grid) {
      return {
        kind: "blocked",
        anchorCell,
        asset,
        footprintW,
        footprintH,
        rotationQuarterTurns,
        affectedProps: [],
        blockedReason: "occupied",
      };
    }

    const preview = this.previewForOccupiedCells(
      anchorCell,
      footprintW,
      footprintH,
      asset,
      rotationQuarterTurns,
      grid,
      selected,
    );
    return preview;
  }

  private previewForPlacement(
    tool: OfficeSetEditorToolPropPayload,
    asset: PropPaletteItem,
    anchorCell: { cellX: number; cellY: number },
  ): TerrainPropPlacementPreview {
    const { footprintW, footprintH } = resolveTerrainPropFootprint(
      asset,
      tool.rotationQuarterTurns,
    );
    const terrainRuntime = this.host.getTerrainRuntime();
    const grid = terrainRuntime?.getGameplayGrid();
    if (!grid) {
      return {
        kind: "blocked",
        anchorCell,
        asset,
        footprintW,
        footprintH,
        rotationQuarterTurns: tool.rotationQuarterTurns,
        affectedProps: [],
        blockedReason: "occupied",
      };
    }

    return this.previewForOccupiedCells(
      anchorCell,
      footprintW,
      footprintH,
      asset,
      tool.rotationQuarterTurns,
      grid,
      null,
    );
  }

  private previewForOccupiedCells(
    anchorCell: { cellX: number; cellY: number },
    footprintW: number,
    footprintH: number,
    asset: PropPaletteItem,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
    grid: ReturnType<TerrainRuntime["getGameplayGrid"]>,
    self: WorldEntity | null,
  ): TerrainPropPlacementPreview {
    const officeRegion = this.host.getOfficeRegion();
    const cells = getTerrainPropPlacementCells(
      anchorCell,
      footprintW,
      footprintH,
    );
    const blockedEntities = new Set<WorldEntity>();
    const affectedProps: WorldEntity[] = [];
    let blockedReason: "out-of-bounds" | "occupied" | null = null;

    for (const cell of cells) {
      const worldCenter = grid.cellToWorldCenter(cell.cellX, cell.cellY);
      if (!worldCenter) {
        blockedReason = "out-of-bounds";
        continue;
      }

      if (
        isCellWithinOfficeRegion(
          officeRegion,
          worldCenter.worldX,
          worldCenter.worldY,
        )
      ) {
        blockedReason = "occupied";
        continue;
      }

      for (const entity of this.host.getEntitySystem()?.getAll() ?? []) {
        if (entity === self) {
          continue;
        }

        if (!isWorldEntityOccupyingCell(entity, cell.cellX, cell.cellY, grid)) {
          continue;
        }

        if (entity.definition.kind === "prop") {
          if (!blockedEntities.has(entity)) {
            blockedEntities.add(entity);
            affectedProps.push(entity);
          }
        } else {
          blockedReason = "occupied";
        }
      }
    }

    return {
      kind:
        blockedReason !== null
          ? "blocked"
          : affectedProps.length > 0
            ? "replace"
            : "place",
      anchorCell,
      asset,
      footprintW,
      footprintH,
      rotationQuarterTurns,
      affectedProps,
      blockedReason,
    };
  }

  private renderPreview(
    preview: TerrainPropPlacementPreview,
    grid: ReturnType<TerrainRuntime["getGameplayGrid"]>,
  ): void {
    const worldCenter = grid.cellToWorldCenter(
      preview.anchorCell.cellX,
      preview.anchorCell.cellY,
    );
    if (!worldCenter) {
      this.hidePreview();
      return;
    }

    const colors = this.resolvePreviewColors(preview);
    const cellSize = TERRAIN_CELL_WORLD_SIZE;
    const widthPx = preview.footprintW * cellSize;
    const heightPx = preview.footprintH * cellSize;
    const ghost = this.ensurePreviewGhost(preview.asset.textureKey);
    ghost.setTexture(preview.asset.textureKey, preview.asset.atlasKey);
    ghost.setOrigin(0.5, 0.75);
    ghost.setDepth(TERRAIN_PROP_PREVIEW_GHOST_DEPTH);
    ghost.setAlpha(TERRAIN_PROP_PREVIEW_GHOST_ALPHA);
    ghost.setDisplaySize(widthPx, heightPx);
    ghost.setRotation((Math.PI / 2) * preview.rotationQuarterTurns);
    ghost.setPosition(worldCenter.worldX, worldCenter.worldY);
    ghost.setVisible(true);

    let visibleCellCount = 0;
    for (let rowOffset = 0; rowOffset < preview.footprintH; rowOffset += 1) {
      for (let colOffset = 0; colOffset < preview.footprintW; colOffset += 1) {
        const cell = this.getPreviewCell(visibleCellCount);
        const worldX = (preview.anchorCell.cellX + colOffset) * cellSize;
        const worldY = (preview.anchorCell.cellY + rowOffset) * cellSize;
        cell.setPosition(worldX, worldY);
        cell.setSize(cellSize, cellSize);
        cell.setFillStyle(colors.fill, TERRAIN_PROP_PREVIEW_FOOTPRINT_ALPHA);
        cell.setStrokeStyle(
          TERRAIN_PROP_PREVIEW_FOOTPRINT_STROKE_WIDTH,
          colors.stroke,
          0.95,
        );
        cell.setVisible(true);
        visibleCellCount += 1;
      }
    }

    for (
      let index = visibleCellCount;
      index < this.previewCells.length;
      index += 1
    ) {
      this.previewCells[index]?.setVisible(false);
    }

    const label = this.ensurePreviewLabel();
    label.setDepth(TERRAIN_PROP_PREVIEW_LABEL_DEPTH);
    label.setText(this.formatPreviewLabel(preview));
    label.setPosition(worldCenter.worldX, Math.max(0, worldCenter.worldY - 18));
    label.setVisible(true);
  }

  private resolvePreviewColors(preview: TerrainPropPlacementPreview): {
    fill: number;
    stroke: number;
  } {
    switch (preview.kind) {
      case "replace":
        return {
          fill: TERRAIN_PROP_PREVIEW_REPLACE_FILL,
          stroke: TERRAIN_PROP_PREVIEW_REPLACE_STROKE,
        };
      case "blocked":
        return {
          fill: TERRAIN_PROP_PREVIEW_BLOCKED_FILL,
          stroke: TERRAIN_PROP_PREVIEW_BLOCKED_STROKE,
        };
      case "place":
      default:
        return {
          fill: TERRAIN_PROP_PREVIEW_PLACE_FILL,
          stroke: TERRAIN_PROP_PREVIEW_PLACE_STROKE,
        };
    }
  }

  private formatPreviewLabel(preview: TerrainPropPlacementPreview): string {
    switch (preview.kind) {
      case "replace": {
        const [first, ...rest] = preview.affectedProps;
        if (!first) {
          return `Replace ${preview.asset.label}`;
        }

        const firstLabel = first.definition.label;
        return rest.length > 0
          ? `Replace ${firstLabel} + ${rest.length} more`
          : `Replace ${firstLabel}`;
      }
      case "blocked":
        return preview.blockedReason === "out-of-bounds"
          ? "Blocked: outside terrain"
          : "Blocked: occupied";
      case "place":
      default:
        return `Place ${preview.asset.label}`;
    }
  }

  private ensurePreviewGhost(textureKey: string): Phaser.GameObjects.Image {
    if (this.previewGhost) {
      return this.previewGhost;
    }

    const ghost = this.host.scene.add.image(0, 0, textureKey);
    ghost.setVisible(false);
    this.previewGhost = ghost;
    return ghost;
  }

  private ensurePreviewLabel(): Phaser.GameObjects.Text {
    if (this.previewLabel) {
      return this.previewLabel;
    }

    const label = this.host.scene.add.text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f8fafc",
      backgroundColor: "#020617",
      padding: { x: 4, y: 2 },
    });
    label.setVisible(false);
    this.previewLabel = label;
    return label;
  }

  private getPreviewCell(index: number): Phaser.GameObjects.Rectangle {
    const existing = this.previewCells[index];
    if (existing) {
      return existing;
    }

    const cell = this.host.scene.add.rectangle(0, 0, 0, 0, 0, 0);
    cell.setOrigin(0, 0);
    cell.setDepth(TERRAIN_PROP_PREVIEW_FOOTPRINT_DEPTH);
    cell.setVisible(false);
    this.previewCells[index] = cell;
    return cell;
  }

  private hidePreview(): void {
    this.previewGhost?.setVisible(false);
    this.previewLabel?.setVisible(false);
    for (const cell of this.previewCells) {
      cell.setVisible(false);
    }
  }
}
