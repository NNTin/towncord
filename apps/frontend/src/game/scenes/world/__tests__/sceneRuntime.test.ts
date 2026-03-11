import { describe, expect, test, vi } from "vitest";
import { WorldSceneRuntime } from "../sceneRuntime";

describe("WorldSceneRuntime", () => {
  test("dispose destroys owned objects and resets runtime state", () => {
    const runtime = new WorldSceneRuntime();
    const terrainSystemDestroy = vi.fn();
    const entitySpriteDestroy = vi.fn();
    const selectionBadgeDestroy = vi.fn();
    const terrainBrushPreviewDestroy = vi.fn();
    const previewImageDestroyA = vi.fn();
    const previewImageDestroyB = vi.fn();

    runtime.catalog = {} as never;
    runtime.entityRegistry = {} as never;
    runtime.entities = [{ sprite: { destroy: entitySpriteDestroy } } as never];
    runtime.selectedEntity = runtime.entities[0] ?? null;
    runtime.selectionBadge = { destroy: selectionBadgeDestroy } as never;
    runtime.terrainBrushPreview = { destroy: terrainBrushPreviewDestroy } as never;
    runtime.terrainBrushRenderPreviewImages = [
      { destroy: previewImageDestroyA } as never,
      { destroy: previewImageDestroyB } as never,
    ];
    runtime.terrainSystem = { destroy: terrainSystemDestroy } as never;
    runtime.navigation = {} as never;
    runtime.nextId = 7;
    runtime.wasd = {} as never;
    runtime.shiftKey = { isDown: true } as never;
    runtime.activeTerrainTool = {
      materialId: "grass",
      brushId: "terrain.brush.square",
    };
    runtime.terrainPaintSession.begin();
    runtime.isPanning = true;
    runtime.panStartX = 10;
    runtime.panStartY = 20;
    runtime.camStartX = 30;
    runtime.camStartY = 40;
    runtime.lastPerfEmitAtMs = 50;
    runtime.directInputIdleMs = 60;

    runtime.dispose();

    expect(terrainSystemDestroy).toHaveBeenCalledOnce();
    expect(entitySpriteDestroy).toHaveBeenCalledOnce();
    expect(selectionBadgeDestroy).toHaveBeenCalledOnce();
    expect(terrainBrushPreviewDestroy).toHaveBeenCalledOnce();
    expect(previewImageDestroyA).toHaveBeenCalledOnce();
    expect(previewImageDestroyB).toHaveBeenCalledOnce();
    expect(runtime.catalog).toBeNull();
    expect(runtime.entityRegistry).toBeNull();
    expect(runtime.entities).toEqual([]);
    expect(runtime.selectedEntity).toBeNull();
    expect(runtime.selectionBadge).toBeNull();
    expect(runtime.terrainBrushPreview).toBeNull();
    expect(runtime.terrainBrushRenderPreviewImages).toEqual([]);
    expect(runtime.terrainSystem).toBeNull();
    expect(runtime.navigation).toBeNull();
    expect(runtime.nextId).toBe(0);
    expect(runtime.wasd).toBeNull();
    expect(runtime.shiftKey).toBeNull();
    expect(runtime.activeTerrainTool).toBeNull();
    expect(runtime.terrainPaintSession.isActive()).toBe(false);
    expect(runtime.isPanning).toBe(false);
    expect(runtime.panStartX).toBe(0);
    expect(runtime.panStartY).toBe(0);
    expect(runtime.camStartX).toBe(0);
    expect(runtime.camStartY).toBe(0);
    expect(runtime.lastPerfEmitAtMs).toBe(0);
    expect(runtime.directInputIdleMs).toBe(0);
  });
});
