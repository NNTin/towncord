import { describe, expect, test, vi } from "vitest";
import {
  UI_TO_RUNTIME_COMMANDS,
  type OfficeSetEditorToolPayload,
  type PlaceEntityDropPayload,
  type PlaceTerrainDropPayload,
  type SelectedTerrainToolPayload,
  type SetZoomPayload,
} from "../../../protocol";
import { WorldSceneCommandBindings } from "../worldSceneCommandBindings";

function createRuntimeHost() {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();

  return {
    events: {
      emit(event: string, payload: unknown) {
        for (const listener of listeners.get(event) ?? []) {
          listener(payload);
        }
      },
      on(event: string, fn: (payload: unknown) => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), fn]);
      },
      off(event: string, fn: (payload: unknown) => void) {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((candidate) => candidate !== fn),
        );
      },
    },
  };
}

describe("WorldSceneCommandBindings", () => {
  test("routes runtime commands to feature handlers and unbinds cleanly", () => {
    const runtimeHost = createRuntimeHost();
    const handlePlaceEntityDrop = vi.fn<(payload: PlaceEntityDropPayload) => void>();
    const handlePlaceTerrainDrop = vi.fn<(payload: PlaceTerrainDropPayload) => void>();
    const handleSelectTerrainTool = vi.fn<(payload: SelectedTerrainToolPayload) => void>();
    const handleSetOfficeEditorTool = vi.fn<(payload: OfficeSetEditorToolPayload) => void>();
    const handleSetZoom = vi.fn<(payload: SetZoomPayload) => void>();
    const bindings = new WorldSceneCommandBindings(
      {
        getRuntimeHost: () => runtimeHost,
      },
      {
        handlePlaceEntityDrop,
        handlePlaceTerrainDrop,
        handleSelectTerrainTool,
        handleSetOfficeEditorTool,
        handleSetZoom,
      },
    );

    bindings.bind();

    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      type: "entity",
      entityId: "player",
      screenX: 10,
      screenY: 20,
    });
    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP, {
      type: "terrain",
      materialId: "grass",
      brushId: "terrain.brush.square",
      screenX: 30,
      screenY: 40,
    });
    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL, {
      materialId: "water",
      brushId: "terrain.brush.square",
    });
    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL, {
      tool: "wall",
    });
    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.SET_ZOOM, {
      zoom: 4,
    });

    expect(handlePlaceEntityDrop).toHaveBeenCalledWith({
      type: "entity",
      entityId: "player",
      screenX: 10,
      screenY: 20,
    });
    expect(handlePlaceTerrainDrop).toHaveBeenCalledWith({
      type: "terrain",
      materialId: "grass",
      brushId: "terrain.brush.square",
      screenX: 30,
      screenY: 40,
    });
    expect(handleSelectTerrainTool).toHaveBeenCalledWith({
      materialId: "water",
      brushId: "terrain.brush.square",
    });
    expect(handleSetOfficeEditorTool).toHaveBeenCalledWith({
      tool: "wall",
    });
    expect(handleSetZoom).toHaveBeenCalledWith({
      zoom: 4,
    });

    bindings.unbind();
    runtimeHost.events.emit(UI_TO_RUNTIME_COMMANDS.SET_ZOOM, {
      zoom: 8,
    });

    expect(handleSetZoom).toHaveBeenCalledTimes(1);
  });
});
