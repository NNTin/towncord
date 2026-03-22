import type { PlaceEntityDropPayload } from "../protocol";
import type { EntityId } from "../domain/model";

type SpawnRequest = {
  entityId: EntityId;
  screenX: number;
  screenY: number;
};

export function mapDropPayloadToSpawnRequest(payload: PlaceEntityDropPayload): SpawnRequest {
  return {
    entityId: payload.entityId,
    screenX: payload.screenX,
    screenY: payload.screenY,
  };
}
