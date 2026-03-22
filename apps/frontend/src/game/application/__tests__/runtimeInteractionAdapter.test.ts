import { describe, expect, test, vi } from "vitest";
import { serializePlaceDragPayload } from "../../protocol";

vi.mock("../runtimeGateway", () => ({
  bloomseedRuntimeGateway: {
    mount: vi.fn(),
  },
}));

import { createRuntimeInteractionAdapter } from "../bloomseedUiBridgeHooks";

function createDropEvent(payload: string) {
  return {
    clientX: 140,
    clientY: 260,
    dataTransfer: {
      dropEffect: "none",
      getData: vi.fn(() => payload),
    },
    preventDefault: vi.fn(),
  } as unknown as React.DragEvent<HTMLDivElement>;
}

describe("createRuntimeInteractionAdapter", () => {
  test("maps drag-and-drop screen coordinates through the runtime root", () => {
    const sessionRef = {
      current: {
        placeDragDrop: vi.fn(),
        setZoom: vi.fn(),
      },
    };
    const runtimeRootRef = {
      current: {
        getBoundingClientRect: () => ({
          left: 40,
          top: 110,
        }),
      },
    } as React.MutableRefObject<HTMLDivElement | null>;
    const adapter = createRuntimeInteractionAdapter({
      runtimeRootRef,
      sessionRef: sessionRef as never,
      zoomState: {
        zoom: 1,
        minZoom: 0.5,
        maxZoom: 2,
      },
    });
    const event = createDropEvent(
      serializePlaceDragPayload({
        type: "terrain",
        materialId: "grass",
        brushId: "paint",
      }),
    );

    adapter.runtimeRootBindings.onDrop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(sessionRef.current.placeDragDrop).toHaveBeenCalledWith(
      {
        type: "terrain",
        materialId: "grass",
        brushId: "paint",
      },
      {
        screenX: 100,
        screenY: 150,
      },
    );
  });

  test("builds zoom controls that send commands through the runtime session", () => {
    const sessionRef = {
      current: {
        placeDragDrop: vi.fn(),
        setZoom: vi.fn(),
      },
    };
    const adapter = createRuntimeInteractionAdapter({
      runtimeRootRef: { current: null },
      sessionRef: sessionRef as never,
      zoomState: {
        zoom: 1,
        minZoom: 0.5,
        maxZoom: 2,
      },
    });

    adapter.zoomViewModel?.onZoomIn();
    adapter.zoomViewModel?.onZoomOut();

    expect(adapter.zoomViewModel).toEqual(
      expect.objectContaining({
        zoom: 1,
        minZoom: 0.5,
        maxZoom: 2,
      }),
    );
    expect(sessionRef.current.setZoom).toHaveBeenNthCalledWith(1, 1.1);
    expect(sessionRef.current.setZoom).toHaveBeenNthCalledWith(2, 0.9);
  });
});
