import { describe, expect, test } from "vitest";
import {
  parsePlaceDragMimePayload,
  parsePlaceDragPayload,
  serializePlaceDragPayload,
  toPlaceDropPayload,
} from "../placeDragPayload";

describe("placeDragPayload transport", () => {
  test("requires explicit drag payload types", () => {
    expect(parsePlaceDragPayload({ entityId: "player.seed" })).toBeNull();
  });

  test("rejects invalid drag mime payload JSON", () => {
    expect(parsePlaceDragMimePayload("{not-json")).toBeNull();
  });

  test("serializes drag payloads and upgrades them into drop payloads", () => {
    const payload = {
      type: "terrain" as const,
      materialId: "grass",
      brushId: "paint",
    };

    expect(parsePlaceDragMimePayload(serializePlaceDragPayload(payload))).toEqual(payload);
    expect(toPlaceDropPayload(payload, 12, 24)).toEqual({
      type: "terrain",
      materialId: "grass",
      brushId: "paint",
      screenX: 12,
      screenY: 24,
    });
  });
});
