import type { PlaceObjectDropPayload } from "../events";
import type { EntityId } from "../domain/model";

export type SpawnRequest = {
  entityId: EntityId;
  screenX: number;
  screenY: number;
};

export function mapDropPayloadToSpawnRequest(payload: PlaceObjectDropPayload): SpawnRequest {
  return {
    entityId: payload.entityId,
    screenX: payload.screenX,
    screenY: payload.screenY,
  };
}
