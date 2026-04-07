// @vitest-environment jsdom

import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TerrainToolSelection } from "../../../../game/contracts/runtime";

vi.mock("public-assets-json:debug/atlas.json", () => ({
  default: {
    meta: { size: { w: 256, h: 256 } },
    frames: {
      "tilesets.debug.environment.autotile-15#0": {
        frame: { x: 0, y: 0, w: 16, h: 16 },
      },
      "tilesets.debug.environment.autotile-15#0@0": {
        frame: { x: 0, y: 0, w: 16, h: 16 },
      },
      "tilesets.debug.environment.autotile-15#15": {
        frame: { x: 0, y: 16, w: 16, h: 16 },
      },
      "tilesets.debug.environment.autotile-15#15@0": {
        frame: { x: 0, y: 16, w: 16, h: 16 },
      },
    },
  },
}));

vi.mock("public-assets-json:farmrpg/atlases/characters.json", () => ({
  default: {
    meta: { size: { w: 1, h: 1 } },
    frames: {},
  },
}));

vi.mock("public-assets-json:bloomseed/atlas.json", () => ({
  default: {
    meta: { size: { w: 1, h: 1 } },
    frames: {},
  },
}));

vi.mock("public-assets-json:donarg-office/atlas.json", () => ({
  default: {
    meta: { size: { w: 64, h: 64 } },
    frames: {
      "furniture.electronics.laptop-front-off#0": {
        frame: { x: 0, y: 0, w: 16, h: 32 },
      },
      "furniture.electronics.laptop-right-off#0": {
        frame: { x: 16, y: 0, w: 32, h: 16 },
      },
      "furniture.electronics.monitor-front-off#0": {
        frame: { x: 48, y: 0, w: 16, h: 16 },
      },
    },
  },
}));

vi.mock("public-assets-json:donarg-office/furniture-catalog.json", () => ({
  default: {
    assets: [
      {
        id: "ASSET_107",
        label: "Laptop - Front - Off",
        category: "electronics",
        file: "furniture/electronics/LAPTOP_FRONT_OFF.png",
        width: 16,
        height: 32,
        footprintW: 1,
        footprintH: 2,
        canPlaceOnSurfaces: true,
        groupId: "LAPTOP",
        orientation: "front",
        state: "off",
      },
      {
        id: "ASSET_78",
        label: "Monitor - Front - Off",
        category: "electronics",
        file: "furniture/electronics/MONITOR_FRONT_OFF.png",
        width: 16,
        height: 16,
        footprintW: 1,
        footprintH: 1,
        canPlaceOnSurfaces: true,
        groupId: "MONITOR",
        orientation: "front",
        state: "off",
      },
      {
        id: "ASSET_109",
        label: "Laptop - Right - Off",
        category: "electronics",
        file: "furniture/electronics/LAPTOP_RIGHT_OFF.png",
        width: 32,
        height: 16,
        footprintW: 2,
        footprintH: 1,
        canPlaceOnSurfaces: true,
        groupId: "LAPTOP",
        orientation: "right",
        state: "off",
      },
    ],
  },
}));

vi.mock("public-assets-json:farmrpg/atlases/props.json", () => ({
  default: {
    meta: { size: { w: 1, h: 1 } },
    frames: {},
  },
}));

vi.mock("public-assets-json:farmrpg/atlases/tilesets.json", () => ({
  default: {
    meta: { size: { w: 256, h: 256 } },
    frames: {
      "tilesets.farmrpg.water.tile#0": {
        frame: { x: 0, y: 0, w: 16, h: 16 },
      },
      "tilesets.farmrpg.grass.spring#0": {
        frame: { x: 16, y: 0, w: 16, h: 16 },
      },
      "tilesets.farmrpg.grass.summer#0": {
        frame: { x: 32, y: 0, w: 16, h: 16 },
      },
      "tilesets.farmrpg.grass.fall#0": {
        frame: { x: 48, y: 0, w: 16, h: 16 },
      },
      "tilesets.farmrpg.grass.winter#0": {
        frame: { x: 64, y: 0, w: 16, h: 16 },
      },
      "tilesets.farmrpg.barn.posts#0": {
        frame: { x: 0, y: 16, w: 16, h: 16 },
      },
      "tilesets.farmrpg.barn.hay#0": {
        frame: { x: 16, y: 16, w: 16, h: 16 },
      },
      "tilesets.farmrpg.barn.messy-hay#0": {
        frame: { x: 32, y: 16, w: 16, h: 16 },
      },
      "tilesets.farmrpg.carpet.variant-01#0": {
        frame: { x: 0, y: 32, w: 16, h: 16 },
      },
      "tilesets.farmrpg.carpet.variant-02#0": {
        frame: { x: 16, y: 32, w: 16, h: 16 },
      },
      "tilesets.farmrpg.carpet.variant-03#0": {
        frame: { x: 32, y: 32, w: 16, h: 16 },
      },
    },
  },
}));

import { BottomToolbar } from "../BottomToolbar";
import { FURNITURE_PALETTE_ITEMS } from "../../../../game/content/structures/furniturePalette";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: ComponentProps<typeof BottomToolbar> = {
  isLayoutMode: true,
  onToggleLayoutMode: vi.fn(),
  isJsonEditorOpen: false,
  onToggleJsonEditor: vi.fn(),
  entityToolbarViewModel: null,
  propToolbarViewModel: null,
  activeTool: null as "floor" | "wall" | "erase" | "furniture" | "prop" | null,
  onSelectTool: vi.fn(),
  activeFloorMode: "paint" as const,
  onSelectFloorMode: vi.fn(),
  activeTileColor: null,
  onSelectTileColor: vi.fn(),
  activeFloorColor: { h: 214, s: 30, b: -100, c: -55 },
  onSelectFloorColor: vi.fn(),
  activeFloorPattern: "environment.floors.pattern-01",
  onSelectFloorPattern: vi.fn(),
  activeWallColor: { h: 214, s: 25, b: -54, c: 17 },
  onSelectWallColor: vi.fn(),
  activeFurnitureId: null,
  activeFurnitureRotationQuarterTurns: 0,
  onSelectFurnitureId: vi.fn(),
  activePropId: null,
  activePropRotationQuarterTurns: 0,
  onSelectPropId: vi.fn(),
  onRotateFurnitureClockwise: vi.fn(),
  onRotatePropClockwise: vi.fn(),
  activeTerrainTool: null as TerrainToolSelection,
  onSelectTerrainTool: vi.fn(),
  selectedOfficePlaceable: null,
  onRotateSelectedOfficePlaceable: vi.fn(),
  onDeleteSelectedOfficePlaceable: vi.fn(),
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

  const rerender = (nextProps = props) => {
    act(() => {
      root.render(<BottomToolbar {...nextProps} />);
    });
  };

  rerender(props);

  return {
    container,
    root,
    rerender,
  };
}

function findButton(
  container: HTMLElement,
  title: string,
): HTMLButtonElement | null {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.getAttribute("title") === title,
  );

  return button instanceof HTMLButtonElement ? button : null;
}

function getButton(container: HTMLElement, title: string): HTMLButtonElement {
  const button = findButton(container, title);
  if (!button) {
    throw new Error(`Missing button with title: ${title}`);
  }

  return button;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("BottomToolbar", () => {
  test("opens a dedicated Layout panel before exposing layout actions", () => {
    const props = {
      ...baseProps,
      isLayoutMode: false,
    };
    const { container, root, rerender } = renderToolbar(props);

    expect(findButton(container, "Floor tool")).toBeNull();
    expect(findButton(container, "Terrain tool")).toBeNull();
    expect(findButton(container, "Save combined layout data")).toBeNull();
    expect(findButton(container, "Toggle JSON editor")).toBeNull();

    act(() => {
      getButton(container, "Toggle layout editing mode").click();
    });

    expect(props.onToggleLayoutMode).toHaveBeenCalledOnce();

    rerender({
      ...props,
      isLayoutMode: true,
    });

    expect(container.textContent).toContain("Layout editing");
    expect(getButton(container, "Floor tool")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(getButton(container, "Terrain tool")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(getButton(container, "Save combined layout data")).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(getButton(container, "Toggle JSON editor")).toBeInstanceOf(
      HTMLButtonElement,
    );

    act(() => {
      getButton(container, "Floor tool").click();
    });

    expect(props.onSelectTool).toHaveBeenCalledWith("floor");

    act(() => {
      root.unmount();
    });
  });

  test("shows the Entities panel outside layout mode and fires onClick through the toolbar view model", () => {
    const onClick = vi.fn();
    const props = {
      ...baseProps,
      isLayoutMode: false,
      entityToolbarViewModel: {
        groups: [
          {
            key: "entity:player",
            label: "Player",
            placeables: [
              {
                id: "entity:player",
                type: "entity" as const,
                entityId: "player",
                label: "Player Spawn",
                groupKey: "entity:player",
                groupLabel: "Player",
                previewFrameKey: null,
              },
            ],
          },
          {
            key: "entity:npc",
            label: "Mobs",
            placeables: [
              {
                id: "entity:npc.greeter",
                type: "entity" as const,
                entityId: "npc.greeter",
                label: "Greeter",
                groupKey: "entity:npc",
                groupLabel: "Mobs",
                previewFrameKey: null,
              },
            ],
          },
        ],
        onClick,
      },
    };
    const { container, root } = renderToolbar(props);

    act(() => {
      getButton(container, "Entity placeables").click();
    });

    expect(container.textContent).toContain("Entity");
    expect(container.textContent).toContain("Player");
    expect(container.textContent).toContain("Mobs");
    expect(container.textContent).toContain("Player Spawn");
    expect(container.textContent).toContain("Greeter");

    const entry = Array.from(container.querySelectorAll("button")).find(
      (element) =>
        element.title === "Spawn Player Spawn" ||
        element.textContent?.includes("Player Spawn"),
    );
    if (!entry) {
      throw new Error("Missing clickable entity entry");
    }

    act(() => {
      entry.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]).toEqual({
      id: "entity:player",
      type: "entity",
      entityId: "player",
      label: "Player Spawn",
      groupKey: "entity:player",
      groupLabel: "Player",
      previewFrameKey: null,
    });

    act(() => {
      root.unmount();
    });
  });

  test("opens Layout props as a real layout tool and selects props by click", () => {
    const props = {
      ...baseProps,
      entityToolbarViewModel: {
        groups: [
          {
            key: "entity:npc",
            label: "Mobs",
            placeables: [
              {
                id: "entity:npc.greeter",
                type: "entity" as const,
                entityId: "npc.greeter",
                label: "Greeter",
                groupKey: "entity:npc",
                groupLabel: "Mobs",
                previewFrameKey: null,
              },
            ],
          },
        ],
        onClick: vi.fn(),
      },
      propToolbarViewModel: {
        groups: [
          {
            key: "entity:prop:set-01",
            label: "Set 01",
            placeables: [
              {
                id: "entity:prop.static.set-01.variant-01",
                type: "entity" as const,
                entityId: "prop.static.set-01.variant-01",
                label: "Variant 01",
                groupKey: "entity:prop:set-01",
                groupLabel: "Set 01",
                previewFrameKey: null,
              },
            ],
          },
        ],
      },
    };
    const { container, root, rerender } = renderToolbar(props);

    act(() => {
      getButton(container, "Props tool").click();
    });

    expect(props.onSelectTool).toHaveBeenCalledWith("prop");
    expect(props.onSelectTerrainTool).toHaveBeenCalledWith(null);

    rerender({
      ...props,
      activeTool: "prop",
    });

    expect(container.textContent).toContain("Layout");
    expect(container.textContent).toContain("Props");
    expect(container.textContent).toContain("Set 01");
    expect(container.textContent).toContain("Variant 01");
    expect(container.textContent).not.toContain("Greeter");

    const entry = Array.from(container.querySelectorAll("button")).find(
      (element) => element.getAttribute("title") === "Select Variant 01",
    );
    if (!(entry instanceof HTMLButtonElement)) {
      throw new Error("Missing selectable prop entry");
    }

    expect(entry.getAttribute("draggable")).toBeNull();

    act(() => {
      entry.click();
    });

    expect(props.onSelectPropId).toHaveBeenCalledWith(
      "prop.static.set-01.variant-01",
    );

    rerender({
      ...props,
      activeTool: "prop",
      activePropId: "prop.static.set-01.variant-01",
      activePropRotationQuarterTurns: 2,
    });

    expect(container.textContent).toContain("Selected: Variant 01");
    expect(container.textContent).toContain("Rotation: 180°");

    const rotateButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === "Rotate",
    );
    if (!(rotateButton instanceof HTMLButtonElement)) {
      throw new Error("Missing rotate prop button");
    }
    act(() => {
      rotateButton.click();
    });

    expect(props.onRotatePropClockwise).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  test("clicking Entity closes Layout and shows an entity preview card", () => {
    const props = {
      ...baseProps,
      activeTool: "wall" as const,
      entityToolbarViewModel: {
        groups: [
          {
            key: "entity:player",
            label: "Player",
            placeables: [
              {
                id: "entity:player",
                type: "entity" as const,
                entityId: "player",
                label: "Player Spawn",
                groupKey: "entity:player",
                groupLabel: "Player",
                previewFrameKey: null,
              },
            ],
          },
        ],
        onClick: vi.fn(),
      },
    };
    const { container, root, rerender } = renderToolbar(props);

    act(() => {
      getButton(container, "Entity placeables").click();
    });

    expect(props.onToggleLayoutMode).toHaveBeenCalledOnce();
    expect(props.onSelectTool).toHaveBeenCalledWith(null);
    rerender({
      ...props,
      isLayoutMode: false,
      activeTool: null,
    });
    expect(container.textContent).toContain("Entity > Player > Player Spawn");
    expect(() => getButton(container, "Floor tool")).toThrow();

    act(() => {
      root.unmount();
    });
  });

  test("layout previews show the concrete furniture asset and update on hover", () => {
    const selectedItem = FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === "ASSET_107",
    );
    const hoveredItem = FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === "ASSET_78",
    );
    if (!selectedItem || !hoveredItem) {
      throw new Error("Missing furniture palette fixtures");
    }

    const props = {
      ...baseProps,
      activeTool: "furniture" as const,
      activeFurnitureId: selectedItem.id,
    };
    const { container, root } = renderToolbar(props);

    expect(container.textContent).toContain(
      "Layout > Furniture > Electronics > Laptop > Laptop - Front - Off",
    );
    expect(container.textContent).toContain(selectedItem.label);

    act(() => {
      getButton(container, hoveredItem.label).dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
    });

    expect(container.textContent).toContain(hoveredItem.label);
    expect(container.textContent).toContain(
      "Layout > Furniture > Electronics > Monitor > Monitor - Front - Off",
    );

    act(() => {
      root.unmount();
    });
  });

  test("shows furniture details plus pending rotation controls while scene preview owns placement", () => {
    const selectedItem = FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === "ASSET_107",
    );
    if (!selectedItem) {
      throw new Error("Missing furniture palette fixture");
    }

    const props = {
      ...baseProps,
      activeTool: "furniture" as const,
      activeFurnitureId: selectedItem.id,
      activeFurnitureRotationQuarterTurns: 1 as const,
    };
    const { container, root } = renderToolbar(props);

    expect(container.textContent).toContain("Rotation: 90°");
    expect(container.textContent).toContain(
      "ghost preview follows your pointer inside the office scene",
    );

    act(() => {
      getButton(container, "Rotate the pending furniture preview").click();
    });

    expect(props.onRotateFurnitureClockwise).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  test("shows the selected placeable card and wires rotate/delete actions", () => {
    const selectedItem = FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === "ASSET_107",
    );
    if (!selectedItem) {
      throw new Error("Missing furniture palette fixture");
    }

    const props = {
      ...baseProps,
      selectedOfficePlaceable: {
        kind: "furniture" as const,
        id: "desk-laptop",
        assetId: selectedItem.id,
        label: selectedItem.label,
        category: selectedItem.category as never,
        placement: selectedItem.placement,
        canRotate: true,
      },
    };
    const { container, root } = renderToolbar(props);

    expect(container.textContent).toContain(
      "Layout > Selected > Electronics > Laptop > Laptop - Front - Off",
    );
    expect(container.textContent).toContain(selectedItem.label);

    act(() => {
      getButton(container, "Rotate selected placeable").click();
      getButton(container, "Delete selected placeable").click();
    });

    expect(props.onRotateSelectedOfficePlaceable).toHaveBeenCalledOnce();
    expect(props.onDeleteSelectedOfficePlaceable).toHaveBeenCalledOnce();

    act(() => {
      root.unmount();
    });
  });

  test("disables rotation when the selected placeable cannot rotate", () => {
    const selectedItem = FURNITURE_PALETTE_ITEMS.find(
      (item) => item.id === "ASSET_107",
    );
    if (!selectedItem) {
      throw new Error("Missing furniture palette fixture");
    }

    const props = {
      ...baseProps,
      selectedOfficePlaceable: {
        kind: "furniture" as const,
        id: "desk-laptop",
        assetId: selectedItem.id,
        label: selectedItem.label,
        category: selectedItem.category as never,
        placement: selectedItem.placement,
        canRotate: false,
      },
    };
    const { container, root } = renderToolbar(props);

    expect(
      getButton(
        container,
        "This selected placeable has no alternate orientation",
      ).disabled,
    ).toBe(true);

    act(() => {
      root.unmount();
    });
  });

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
      terrainSourceId: "public-assets:terrain/farmrpg-grass",
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

  test("wall sub-panel exposes the same HSBC color controls as floor", () => {
    const props = {
      ...baseProps,
      activeTool: "wall" as const,
    };
    const { container, root } = renderToolbar(props);

    act(() => {
      getButton(container, "Adjust wall color").click();
    });

    const hueSlider = container.querySelector('input[type="range"]');
    if (!(hueSlider instanceof HTMLInputElement)) {
      throw new Error("Missing wall hue slider");
    }
    const setSliderValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setSliderValue) {
      throw new Error("Missing HTMLInputElement.value setter");
    }

    act(() => {
      setSliderValue.call(hueSlider, "180");
      hueSlider.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(props.onSelectWallColor).toHaveBeenCalledWith({
      h: 180,
      s: 25,
      b: -54,
      c: 17,
    });

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

    expect(getButton(container, "Terrain tool").textContent).toContain(
      "Terrain",
    );
    expect(
      getButton(container, "FarmRPG Spring Water Tile Brush"),
    ).toBeInstanceOf(HTMLButtonElement);
    expect(
      getButton(container, "FarmRPG Spring Ground Tile Brush"),
    ).toBeInstanceOf(HTMLButtonElement);
    expect(container.textContent).toContain("Spring");
    expect(container.textContent).toContain("Summer");
    expect(container.textContent).toContain("Fall");
    expect(container.textContent).toContain("Winter");

    act(() => {
      root.unmount();
    });

    vi.useRealTimers();
  });

  test("the FarmRPG terrain tab selects seasonal FarmRPG terrain content", () => {
    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
        terrainSourceId: "public-assets:terrain/phase1" as const,
      },
    };
    const { container, root } = renderToolbar(props);
    const farmrpgTab = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === "FarmRPG",
    );
    if (!(farmrpgTab instanceof HTMLButtonElement)) {
      throw new Error("Missing FarmRPG terrain tab button");
    }

    act(() => {
      farmrpgTab.click();
    });

    act(() => {
      getButton(container, "FarmRPG Summer Water Tile Brush").click();
    });

    expect(props.onSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "water",
      brushId: "water",
      terrainSourceId: "public-assets:terrain/farmrpg-grass-summer",
    });

    act(() => {
      root.unmount();
    });
  });

  test("static FarmRPG terrain variants stay on the FarmRPG tab and select ground terrain", () => {
    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
        terrainSourceId: "public-assets:terrain/farmrpg-barn-posts" as const,
      },
    };
    const { container, root } = renderToolbar(props);

    expect(container.textContent).toContain("Barn");
    expect(getButton(container, "Barn Posts")).toBeInstanceOf(
      HTMLButtonElement,
    );

    act(() => {
      getButton(container, "Barn Hay").click();
    });

    expect(props.onSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "ground",
      brushId: "ground",
      terrainSourceId: "public-assets:terrain/farmrpg-barn-hay",
    });

    act(() => {
      root.unmount();
    });
  });

  test("the Terrain panel does not show carpet variants when the terrain tool is active", () => {
    vi.useFakeTimers();

    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
        terrainSourceId: "public-assets:terrain/farmrpg-grass" as const,
      },
    };
    const { container, root } = renderToolbar(props);

    // Terrain panel is visible
    expect(container.textContent).toContain("Spring");

    // Carpet variants must not appear in the Terrain panel
    expect(findButton(container, "Carpet 01")).toBeNull();
    expect(findButton(container, "Carpet 02")).toBeNull();
    expect(findButton(container, "Carpet 03")).toBeNull();

    act(() => {
      root.unmount();
    });

    vi.useRealTimers();
  });

  test("Carpet button is present in the Layout panel and activates the first carpet variant", () => {
    const { container, root } = renderToolbar(baseProps);

    expect(getButton(container, "Carpet tool")).toBeInstanceOf(
      HTMLButtonElement,
    );

    act(() => {
      getButton(container, "Carpet tool").click();
    });

    expect(baseProps.onSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "ground",
      brushId: "ground",
      terrainSourceId: "public-assets:terrain/farmrpg-carpet-01",
    });

    act(() => {
      root.unmount();
    });
  });

  test("carpet tool shows the CarpetSubPanel with carpet variants and not the Terrain panel", () => {
    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
        terrainSourceId: "public-assets:terrain/farmrpg-carpet-01" as const,
      },
    };
    const { container, root } = renderToolbar(props);

    expect(container.textContent).toContain("Carpet");
    expect(getButton(container, "Carpet 01")).toBeInstanceOf(HTMLButtonElement);
    expect(getButton(container, "Carpet 02")).toBeInstanceOf(HTMLButtonElement);
    expect(getButton(container, "Carpet 03")).toBeInstanceOf(HTMLButtonElement);

    // Terrain panel items should not be visible when carpet is active
    expect(
      findButton(container, "FarmRPG Spring Ground Tile Brush"),
    ).toBeNull();

    act(() => {
      getButton(container, "Carpet 02").click();
    });

    expect(props.onSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "ground",
      brushId: "ground",
      terrainSourceId: "public-assets:terrain/farmrpg-carpet-02",
    });

    act(() => {
      root.unmount();
    });
  });

  test("carpet tool is shown as active and clicking it deactivates the carpet selection", () => {
    const props = {
      ...baseProps,
      activeTerrainTool: {
        materialId: "ground",
        brushId: "ground",
        terrainSourceId: "public-assets:terrain/farmrpg-carpet-02" as const,
      },
    };
    const { container, root } = renderToolbar(props);

    act(() => {
      getButton(container, "Carpet tool").click();
    });

    // Re-clicking active carpet deactivates it
    expect(props.onSelectTerrainTool).toHaveBeenCalledWith(null);

    act(() => {
      root.unmount();
    });
  });

  test("Carpet button is disabled and does not call onSelectTerrainTool when no carpet atlas frames exist", async () => {
    // Reset modules so vi.doMock overrides take effect for this test
    vi.resetModules();

    vi.doMock("public-assets-json:farmrpg/atlases/tilesets.json", () => ({
      default: {
        // No carpet frames — simulates environment before atlas generation
        meta: { size: { w: 256, h: 256 } },
        frames: {
          "tilesets.farmrpg.water.tile#0": {
            frame: { x: 0, y: 0, w: 16, h: 16 },
          },
          "tilesets.farmrpg.grass.spring#0": {
            frame: { x: 16, y: 0, w: 16, h: 16 },
          },
        },
      },
    }));

    const { BottomToolbar: BT } = await import("../BottomToolbar");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(container);

    const onSelectTerrainTool = vi.fn();
    act(() => {
      root.render(
        <BT
          {...baseProps}
          isLayoutMode
          onSelectTerrainTool={onSelectTerrainTool}
        />,
      );
    });

    const carpetBtn = getButton(container, "Carpet tool");
    expect(carpetBtn.disabled).toBe(true);

    act(() => {
      carpetBtn.click();
    });

    expect(onSelectTerrainTool).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });

    vi.resetModules();
  });
});
