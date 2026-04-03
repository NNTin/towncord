import { useEffect } from "react";
import { canRotateFurniturePaletteItem } from "../../game/contracts/content";
import type { OfficeSelectedPlaceablePayload } from "../../game/contracts/office-editor";
import { isEditableTarget } from "./debugMode";

type UseFurnitureRotateHotkeyOptions = {
  activeTool: string | null;
  activeFurnitureId: string | null;
  onRotateFurnitureClockwise: () => void;
  activePropId: string | null;
  onRotatePropClockwise: () => void;
  selectedOfficePlaceable: OfficeSelectedPlaceablePayload | null;
  onRotateSelectedOfficePlaceable: () => void;
};

/**
 * Adds a keyboard hotkey (R) for rotating furniture.
 *
 * - When a placed furniture is selected and can be rotated, pressing R rotates it.
 * - When the furniture placement tool is active with a rotatable item selected,
 *   pressing R cycles the placement preview to the next rotation variant.
 * - When the prop placement tool is active with a prop selected, pressing R
 *   rotates the pending terrain prop preview.
 * - Does nothing if the active or selected item has no rotation variants.
 */
export function useFurnitureRotateHotkey({
  activeTool,
  activeFurnitureId,
  onRotateFurnitureClockwise,
  activePropId,
  onRotatePropClockwise,
  selectedOfficePlaceable,
  onRotateSelectedOfficePlaceable,
}: UseFurnitureRotateHotkeyOptions): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditableTarget(event.target) ||
        event.key.toLowerCase() !== "r"
      ) {
        return;
      }

      if (selectedOfficePlaceable?.canRotate) {
        event.preventDefault();
        onRotateSelectedOfficePlaceable();
        return;
      }

      if (
        activeTool === "furniture" &&
        canRotateFurniturePaletteItem(activeFurnitureId)
      ) {
        event.preventDefault();
        onRotateFurnitureClockwise();
        return;
      }

      if (activeTool === "prop" && activePropId) {
        event.preventDefault();
        onRotatePropClockwise();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTool,
    activeFurnitureId,
    onRotateFurnitureClockwise,
    activePropId,
    onRotatePropClockwise,
    selectedOfficePlaceable,
    onRotateSelectedOfficePlaceable,
  ]);
}
