import { useEffect, useState } from "react";
import { frontendConfig } from "../../config";

export const DEBUG_MODE_URL_PARAM = "debug";
export const DEBUG_MODE_SHORTCUT_LABEL = "Alt+Shift+D";

const TRUE_SEARCH_PARAM_VALUES = new Set(["", "1", "true", "on", "yes"]);
const FALSE_SEARCH_PARAM_VALUES = new Set(["0", "false", "off", "no"]);

function normalizeBooleanSearchParam(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (TRUE_SEARCH_PARAM_VALUES.has(normalizedValue)) {
    return true;
  }

  if (FALSE_SEARCH_PARAM_VALUES.has(normalizedValue)) {
    return false;
  }

  return true;
}

export function readDebugModeOverride(search: string): boolean | null {
  const searchParams = new URLSearchParams(search);

  if (!searchParams.has(DEBUG_MODE_URL_PARAM)) {
    return null;
  }

  return normalizeBooleanSearchParam(searchParams.get(DEBUG_MODE_URL_PARAM));
}

export function resolveDebugModeEnabled(
  search: string,
  defaultEnabled: boolean,
): boolean {
  return readDebugModeOverride(search) ?? defaultEnabled;
}

export function buildDebugModeSearch(
  search: string,
  enabled: boolean,
  defaultEnabled: boolean,
): string {
  const searchParams = new URLSearchParams(search);

  if (enabled === defaultEnabled) {
    searchParams.delete(DEBUG_MODE_URL_PARAM);
  } else {
    searchParams.set(DEBUG_MODE_URL_PARAM, enabled ? "1" : "0");
  }

  const nextSearch = searchParams.toString();
  return nextSearch.length > 0 ? `?${nextSearch}` : "";
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function isDebugModeShortcut(event: KeyboardEvent): boolean {
  return (
    event.altKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key.toLowerCase() === "d"
  );
}

export function useDebugUiEnabled(
  defaultEnabled = frontendConfig.features.debugUiEnabledByDefault,
): boolean {
  const [isDebugUiEnabled, setIsDebugUiEnabled] = useState(() =>
    typeof window === "undefined"
      ? defaultEnabled
      : resolveDebugModeEnabled(window.location.search, defaultEnabled),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function syncFromLocation(): void {
      setIsDebugUiEnabled(
        resolveDebugModeEnabled(window.location.search, defaultEnabled),
      );
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        event.repeat ||
        isEditableTarget(event.target) ||
        !isDebugModeShortcut(event)
      ) {
        return;
      }

      event.preventDefault();

      setIsDebugUiEnabled((currentValue) => {
        const nextValue = !currentValue;
        const nextSearch = buildDebugModeSearch(
          window.location.search,
          nextValue,
          defaultEnabled,
        );

        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${nextSearch}${window.location.hash}`,
        );

        return nextValue;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", syncFromLocation);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [defaultEnabled]);

  return isDebugUiEnabled;
}
