import { describe, expect, test, vi } from "vitest";

vi.mock("../../../../game/session", () => {
  return {
    gameSessionFactory: {
      mount: vi.fn(),
    },
  };
});

import { createRuntimeInteractionAdapter } from "../runtimeUiBridgeHooks";

describe("createRuntimeInteractionAdapter", () => {
  test("builds zoom controls that send commands through the runtime session", () => {
    const sessionRef = {
      current: {
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

  test("suppresses the browser context menu inside the runtime host", () => {
    const adapter = createRuntimeInteractionAdapter({
      runtimeRootRef: { current: null },
      sessionRef: { current: null } as never,
      zoomState: null,
    });
    const event = {
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent<HTMLDivElement>;

    adapter.runtimeRootBindings.onContextMenu(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
