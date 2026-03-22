import type { PlaceObjectDropPayload } from "../protocol";
import type { EntityId } from "../domain/model";

type SpawnRequest = {
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
