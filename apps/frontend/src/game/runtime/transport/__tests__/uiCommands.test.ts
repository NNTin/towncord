import { describe, expect, test, vi } from "vitest";
import {
  bindUiToRuntimeCommand,
  emitPlaceDropCommand,
  normalizeOfficeSetEditorToolPayload,
  normalizeUiToRuntimeCommandPayload,
  UI_TO_RUNTIME_COMMANDS,
} from "../uiCommands";

type Listener = (payload: unknown) => void;

function createHost() {
  const listeners = new Map<string, Set<Listener>>();

  return {
    host: {
      events: {
        emit(event: string, payload: unknown) {
          for (const listener of listeners.get(event) ?? []) {
            listener(payload);
          }
        },
        on(event: string, fn: Listener) {
          const eventListeners = listeners.get(event) ?? new Set<Listener>();
          eventListeners.add(fn);
          listeners.set(event, eventListeners);
        },
        off(event: string, fn: Listener) {
          listeners.get(event)?.delete(fn);
        },
      },
    },
  };
}

describe("uiCommands transport", () => {
  test("rejects malformed entity drop commands at the command boundary", () => {
    expect(
      normalizeUiToRuntimeCommandPayload(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
        type: "terrain",
        entityId: "player.seed",
        screenX: 32,
        screenY: 48,
      }),
    ).toBeUndefined();
    expect(
      normalizeUiToRuntimeCommandPayload(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
        entityId: "player.seed",
        screenX: 32,
        screenY: 48,
      }),
    ).toBeUndefined();
  });

  test("validates and clones office editor tool payloads", () => {
    const floorColor = { h: 214, s: 30, b: -100, c: -55 };
    const payload = normalizeOfficeSetEditorToolPayload({
      tool: "floor",
      floorMode: "pick",
      tileColor: "blue",
      floorColor,
      floorPattern: "environment.floors.pattern-03",
    });

    expect(payload).toEqual({
      tool: "floor",
      floorMode: "pick",
      tileColor: "blue",
      floorColor,
      floorPattern: "environment.floors.pattern-03",
    });
    expect(payload).not.toBeUndefined();
    expect(payload?.tool).toBe("floor");
    expect(payload && payload.tool === "floor" ? payload.floorColor : null).not.toBe(floorColor);
    expect(
      normalizeOfficeSetEditorToolPayload({
        tool: "floor",
        floorMode: "pick",
        tileColor: "teal",
        floorColor,
        floorPattern: "environment.floors.pattern-03",
      }),
    ).toBeUndefined();
  });

  test("bindUiToRuntimeCommand drops malformed entity payloads", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const unbind = bindUiToRuntimeCommand(
      host,
      UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP,
      handler,
    );

    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      type: "entity",
      entityId: "player.seed",
      screenX: 16,
      screenY: 24,
    });
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      entityId: 42,
      screenX: 16,
      screenY: 24,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "entity",
      entityId: "player.seed",
      screenX: 16,
      screenY: 24,
    });

    unbind();
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_ENTITY_DROP, {
      type: "entity",
      entityId: "player.seed",
      screenX: 32,
      screenY: 40,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("emitPlaceDropCommand routes normalized payloads to the correct command", () => {
    const { host } = createHost();
    const emitSpy = vi.spyOn(host.events, "emit");

    emitPlaceDropCommand(host, {
      type: "terrain",
      materialId: "stone",
      brushId: "fill",
      screenX: 12,
      screenY: 24,
    });

    expect(emitSpy).toHaveBeenCalledWith(UI_TO_RUNTIME_COMMANDS.PLACE_TERRAIN_DROP, {
      type: "terrain",
      materialId: "stone",
      brushId: "fill",
      screenX: 12,
      screenY: 24,
    });
  });
});
