// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useFurnitureRotateHotkey } from "../useFurnitureRotateHotkey";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../game/contracts/content", () => ({
  canRotateFurniturePaletteItem: (id: string | null | undefined) =>
    id === "rotatable-chair",
}));

type HarnessProps = {
  activeTool: string | null;
  activeFurnitureId: string | null;
  onRotateFurnitureClockwise: () => void;
  activePropId: string | null;
  onRotatePropClockwise: () => void;
  selectedOfficePlaceable: { canRotate: boolean } | null;
  onRotateSelectedOfficePlaceable: () => void;
};

function Harness(props: HarnessProps): null {
  useFurnitureRotateHotkey(
    props as Parameters<typeof useFurnitureRotateHotkey>[0],
  );
  return null;
}

async function renderHarness(props: HarnessProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness {...props} />);
  });

  return {
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function pressKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      ...modifiers,
    }),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFurnitureRotateHotkey", () => {
  describe("furniture placement mode", () => {
    test("calls onRotateFurnitureClockwise when R is pressed with a rotatable item selected", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateFurnitureClockwise).toHaveBeenCalledOnce();
      await harness.unmount();
    });

    test("does not rotate when the selected item has no rotation variants", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "non-rotatable-desk",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("does not rotate when no furniture item is selected", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: null,
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("does not rotate when a different tool is active", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "floor",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });
  });

  describe("selected placed furniture", () => {
    test("calls onRotateSelectedOfficePlaceable when R is pressed with a rotatable placed item", async () => {
      const onRotateSelectedOfficePlaceable = vi.fn();
      const harness = await renderHarness({
        activeTool: null,
        activeFurnitureId: null,
        onRotateFurnitureClockwise: vi.fn(),
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: { canRotate: true },
        onRotateSelectedOfficePlaceable,
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateSelectedOfficePlaceable).toHaveBeenCalledOnce();
      await harness.unmount();
    });

    test("does not rotate when the selected placed item cannot rotate", async () => {
      const onRotateSelectedOfficePlaceable = vi.fn();
      const harness = await renderHarness({
        activeTool: null,
        activeFurnitureId: null,
        onRotateFurnitureClockwise: vi.fn(),
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: { canRotate: false },
        onRotateSelectedOfficePlaceable,
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateSelectedOfficePlaceable).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("prefers rotating selected placed furniture over placement preview", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const onRotateSelectedOfficePlaceable = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: { canRotate: true },
        onRotateSelectedOfficePlaceable,
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateSelectedOfficePlaceable).toHaveBeenCalledOnce();
      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });
  });

  describe("key guard conditions", () => {
    test("ignores R key with modifier keys", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r", { ctrlKey: true });
        pressKey("r", { altKey: true });
        pressKey("r", { shiftKey: true });
        pressKey("r", { metaKey: true });
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("ignores R key when typing in an input field", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      const input = document.createElement("input");
      document.body.appendChild(input);

      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "r", bubbles: true }),
        );
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("ignores repeated key events", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "r",
            bubbles: true,
            repeat: true,
          }),
        );
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
      await harness.unmount();
    });

    test("removes the keydown listener on unmount", async () => {
      const onRotateFurnitureClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "furniture",
        activeFurnitureId: "rotatable-chair",
        onRotateFurnitureClockwise,
        activePropId: null,
        onRotatePropClockwise: vi.fn(),
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await harness.unmount();

      await act(async () => {
        pressKey("r");
      });

      expect(onRotateFurnitureClockwise).not.toHaveBeenCalled();
    });

    test("calls onRotatePropClockwise when R is pressed with a prop selected", async () => {
      const onRotatePropClockwise = vi.fn();
      const harness = await renderHarness({
        activeTool: "prop",
        activeFurnitureId: null,
        onRotateFurnitureClockwise: vi.fn(),
        activePropId: "prop.static.set-01.variant-01",
        onRotatePropClockwise,
        selectedOfficePlaceable: null,
        onRotateSelectedOfficePlaceable: vi.fn(),
      });

      await act(async () => {
        pressKey("r");
      });

      expect(onRotatePropClockwise).toHaveBeenCalledOnce();
      await harness.unmount();
    });
  });
});
