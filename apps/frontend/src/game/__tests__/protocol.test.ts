import { describe, expect, test, vi } from "vitest";
import {
  RUNTIME_TO_UI_EVENTS,
  UI_TO_RUNTIME_COMMANDS,
  bindRuntimeToUiEvent,
  bindUiToRuntimeCommand,
  normalizeOfficeSetEditorToolPayload,
  normalizeUiToRuntimeCommandPayload,
  parsePlaceDragMimePayload,
  parsePlaceDragPayload,
} from "../protocol";

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

describe("protocol boundary", () => {
  test("parses legacy drag payloads without an explicit type", () => {
    expect(parsePlaceDragPayload({ entityId: "player.seed" })).toEqual({
      type: "entity",
      entityId: "player.seed",
    });
  });

  test("rejects invalid drag mime payload JSON", () => {
    expect(parsePlaceDragMimePayload("{not-json")).toBeNull();
  });

  test("normalizes legacy entity drop commands at the command boundary", () => {
    expect(
      normalizeUiToRuntimeCommandPayload(UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP, {
        entityId: "player.seed",
        screenX: 32,
        screenY: 48,
      }),
    ).toEqual({
      type: "entity",
      entityId: "player.seed",
      screenX: 32,
      screenY: 48,
    });
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

  test("bindUiToRuntimeCommand drops malformed payloads and keeps compatibility shims", () => {
    const { host } = createHost();
    const handler = vi.fn();
    const unbind = bindUiToRuntimeCommand(
      host,
      UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP,
      handler,
    );

    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP, {
      entityId: "player.seed",
      screenX: 16,
      screenY: 24,
    });
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP, {
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
    host.events.emit(UI_TO_RUNTIME_COMMANDS.PLACE_OBJECT_DROP, {
      entityId: "player.seed",
      screenX: 32,
      screenY: 40,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("bindRuntimeToUiEvent normalizes zoom payloads before delivery", () => {
    const { host } = createHost();
    const handler = vi.fn();

    bindRuntimeToUiEvent(host, RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, handler);

    host.events.emit(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, {
      zoom: 24,
      minZoom: 16,
      maxZoom: 1,
    });

    expect(handler).toHaveBeenCalledWith({
      zoom: 16,
      minZoom: 1,
      maxZoom: 16,
    });
  });
});
