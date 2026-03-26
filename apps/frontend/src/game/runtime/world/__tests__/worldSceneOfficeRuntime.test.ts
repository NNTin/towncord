import { describe, expect, test, vi } from "vitest";
import { RUNTIME_TO_UI_EVENTS } from "../../transport/runtimeEvents";
import { WorldSceneOfficeRuntime } from "../worldSceneOfficeRuntime";
import { WorldSceneProjectionEmitter } from "../worldSceneProjections";

const officeRenderMocks = vi.hoisted(() => ({
  renderOfficeLayout: vi.fn(() => ({
    destroy: vi.fn(),
    partialUpdate: vi.fn(),
  })),
}));

vi.mock("../../../../engine", () => ({
  renderOfficeLayout: officeRenderMocks.renderOfficeLayout,
  WORLD_REGION_BASE_PX: 16,
}));

function createLayout() {
  return {
    cols: 1,
    rows: 1,
    cellSize: 16,
    tiles: [
      {
        kind: "void" as const,
        tileId: 0,
      },
    ],
    furniture: [],
    characters: [],
  };
}

function createHarness() {
  const emit = vi.fn();
  const highlight = {
    setDepth: vi.fn(),
    setOrigin: vi.fn(),
    setPosition: vi.fn(),
    setStrokeStyle: vi.fn(),
    setVisible: vi.fn(),
  };
  const scene = {
    add: {
      rectangle: vi.fn(() => highlight),
    },
    cameras: {
      main: {
        getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })),
      },
    },
    input: {
      activePointer: {
        withinGame: true,
        x: 20,
        y: 20,
      },
    },
  };
  const runtime = new WorldSceneOfficeRuntime(
    {
      scene: scene as never,
      getActivePointer: () => scene.input.activePointer as never,
      getWorldPoint: (screenX, screenY) => ({
        x: screenX,
        y: screenY,
      }),
    },
    new WorldSceneProjectionEmitter({
      getRuntimeHost: () => ({
        events: {
          emit,
          on: vi.fn(),
          off: vi.fn(),
        },
      }),
    }),
  );

  return {
    emit,
    highlight,
    runtime,
    scene,
  };
}

describe("WorldSceneOfficeRuntime", () => {
  test("bootstraps the office renderable and highlight overlay", () => {
    const { highlight, runtime, scene } = createHarness();
    const layout = createLayout();

    runtime.bootstrap(layout);

    expect(officeRenderMocks.renderOfficeLayout).toHaveBeenCalledOnce();
    expect(scene.add.rectangle).toHaveBeenCalledOnce();
    expect(highlight.setOrigin).toHaveBeenCalledWith(0, 0);
  });

  test("rerenders and emits layout projections after office edits", () => {
    const { emit, runtime } = createHarness();
    const layout = createLayout();

    runtime.bootstrap(layout);
    runtime.handleSetEditorTool({
      tool: "wall",
    });

    expect(
      runtime.tryHandlePointerDown({
        button: 0,
        isDown: true,
        x: 20,
        y: 20,
      } as never),
    ).toBe(true);

    runtime.update();

    const renderResults = officeRenderMocks.renderOfficeLayout.mock.results;
    const renderable =
      renderResults[renderResults.length - 1]?.value;
    expect(renderable?.partialUpdate).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      expect.objectContaining({
        layout: expect.objectContaining({
          tiles: [expect.objectContaining({ kind: "wall" })],
        }),
      }),
    );
  });
});
