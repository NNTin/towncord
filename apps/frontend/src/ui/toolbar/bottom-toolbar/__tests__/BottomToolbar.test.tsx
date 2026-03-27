// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BottomToolbar } from "../BottomToolbar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const baseProps = {
  isLayoutMode: true,
  onToggleLayoutMode: vi.fn(),
  isJsonEditorOpen: false,
  onToggleJsonEditor: vi.fn(),
  activeTool: null as "floor" | "wall" | "erase" | "furniture" | null,
  onSelectTool: vi.fn(),
  activeFloorMode: "paint" as const,
  onSelectFloorMode: vi.fn(),
  activeTileColor: null,
  onSelectTileColor: vi.fn(),
  activeFloorColor: { h: 214, s: 30, b: -100, c: -55 },
  onSelectFloorColor: vi.fn(),
  activeFloorPattern: "environment.floors.pattern-01",
  onSelectFloorPattern: vi.fn(),
  activeFurnitureId: null,
  onSelectFurnitureId: vi.fn(),
  activeTerrainTool: null as { materialId: string; brushId: string } | null,
  onSelectTerrainTool: vi.fn(),
  onResetLayout: vi.fn(),
  onSaveLayout: vi.fn(),
  canResetLayout: true,
  canSaveLayout: true,
  isLayoutDirty: false,
  isTerrainDirty: false,
  isSavingLayout: false,
  layoutStatusText: null,
};

function renderToolbar(props = baseProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<BottomToolbar {...props} />);
  });

  return {
    container,
    root,
  };
}

function getButton(container: HTMLElement, title: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.getAttribute("title") === title,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button with title: ${title}`);
  }

  return button;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("BottomToolbar", () => {
  test("activating Terrain selects the ground brush", () => {
    const props = {
      ...baseProps,
      activeTool: "floor" as const,
    };
    const { container, root } = renderToolbar(props);

    act(() => {
      getButton(container, "Terrain tool").click();
    });

    expect(props.onSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "ground",
      brushId: "ground",
    });
    expect(props.onSelectTool).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  test("selecting an office tool clears Terrain first", () => {
    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "water",
        brushId: "water",
      },
    };
    const { container, root } = renderToolbar(props);

    act(() => {
      getButton(container, "Wall tool").click();
    });

    expect(props.onSelectTerrainTool).toHaveBeenCalledWith(null);
    expect(props.onSelectTool).toHaveBeenCalledWith("wall");

    act(() => {
      root.unmount();
    });
  });

  test("the Terrain panel shows animated brush thumbnails", () => {
    vi.useFakeTimers();

    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
      },
    };
    const { container, root } = renderToolbar(props);

    expect(getButton(container, "Terrain tool").textContent).toContain("Terrain");
    expect(getButton(container, "Water Tile Brush")).toBeInstanceOf(HTMLButtonElement);
    expect(getButton(container, "Ground Tile Brush")).toBeInstanceOf(HTMLButtonElement);

    act(() => {
      root.unmount();
    });

    vi.useRealTimers();
  });
});
