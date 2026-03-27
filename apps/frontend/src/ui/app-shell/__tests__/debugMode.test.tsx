// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import {
  buildDebugModeSearch,
  isDebugModeShortcut,
  resolveDebugModeEnabled,
  useDebugUiEnabled,
} from "../debugMode";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type HarnessProps = {
  defaultEnabled: boolean;
  onRender: (enabled: boolean) => void;
};

function Harness({ defaultEnabled, onRender }: HarnessProps): null {
  onRender(useDebugUiEnabled(defaultEnabled));
  return null;
}

async function renderHarness(defaultEnabled: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue: boolean | null = null;

  await act(async () => {
    root.render(
      <Harness
        defaultEnabled={defaultEnabled}
        onRender={(enabled) => {
          latestValue = enabled;
        }}
      />,
    );
  });

  return {
    getValue() {
      if (latestValue === null) {
        throw new Error("The debug mode hook did not render.");
      }

      return latestValue;
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("debugMode helpers", () => {
  test("resolves runtime overrides ahead of the environment default", () => {
    expect(resolveDebugModeEnabled("", true)).toBe(true);
    expect(resolveDebugModeEnabled("", false)).toBe(false);
    expect(resolveDebugModeEnabled("?debug=0", true)).toBe(false);
    expect(resolveDebugModeEnabled("?debug=1", false)).toBe(true);
    expect(resolveDebugModeEnabled("?debug", false)).toBe(true);
  });

  test("persists only non-default debug states into the URL", () => {
    expect(buildDebugModeSearch("", true, false)).toBe("?debug=1");
    expect(buildDebugModeSearch("?mode=preview", false, true)).toBe(
      "?mode=preview&debug=0",
    );
    expect(buildDebugModeSearch("?mode=preview&debug=1", false, false)).toBe(
      "?mode=preview",
    );
  });

  test("matches only the Alt+Shift+D shortcut", () => {
    expect(
      isDebugModeShortcut(
        new KeyboardEvent("keydown", {
          altKey: true,
          shiftKey: true,
          key: "D",
        }),
      ),
    ).toBe(true);

    expect(
      isDebugModeShortcut(
        new KeyboardEvent("keydown", {
          ctrlKey: true,
          shiftKey: true,
          key: "D",
        }),
      ),
    ).toBe(false);
  });
});

describe("useDebugUiEnabled", () => {
  test("hydrates from the current URL override", async () => {
    window.history.replaceState(null, "", "/?debug=1");
    const harness = await renderHarness(false);

    expect(harness.getValue()).toBe(true);

    await harness.unmount();
  });

  test("toggles debug mode with the keyboard shortcut and updates the URL", async () => {
    window.history.replaceState(null, "", "/?mode=preview");
    const harness = await renderHarness(false);

    expect(harness.getValue()).toBe(false);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          key: "D",
          shiftKey: true,
        }),
      );
    });

    expect(harness.getValue()).toBe(true);
    expect(window.location.search).toBe("?mode=preview&debug=1");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          key: "D",
          shiftKey: true,
        }),
      );
    });

    expect(harness.getValue()).toBe(false);
    expect(window.location.search).toBe("?mode=preview");

    await harness.unmount();
  });

  test("ignores the shortcut while typing into form fields", async () => {
    const harness = await renderHarness(false);
    const input = document.createElement("input");
    document.body.appendChild(input);

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          altKey: true,
          bubbles: true,
          key: "D",
          shiftKey: true,
        }),
      );
    });

    expect(harness.getValue()).toBe(false);
    expect(window.location.search).toBe("");

    await harness.unmount();
  });

  test("syncs with browser history changes", async () => {
    const harness = await renderHarness(false);

    expect(harness.getValue()).toBe(false);

    await act(async () => {
      window.history.pushState(null, "", "/?debug=1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(harness.getValue()).toBe(true);

    await harness.unmount();
  });
});
