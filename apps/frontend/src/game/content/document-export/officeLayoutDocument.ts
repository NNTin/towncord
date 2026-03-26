import type { OfficeLayoutDocument } from "../../../data";
import type { OfficeSceneLayout } from "../../officeLayoutContract";

export type { OfficeLayoutDocument } from "../../../data";

export function formatOfficeLayout(document: OfficeLayoutDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function syncFromRuntimeLayout(
  layout: OfficeSceneLayout,
): OfficeLayoutDocument {
  return {
    version: 2,
    cols: layout.cols,
    rows: layout.rows,
    cellSize: layout.cellSize,
    tiles: layout.tiles,
    furniture: layout.furniture,
    characters: layout.characters,
  };
}
