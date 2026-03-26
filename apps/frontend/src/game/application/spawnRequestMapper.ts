import type { EntityId } from "../world/entities/model";

type SpawnRequest = {
  entityId: EntityId;
  screenX: number;
  screenY: number;
};

type PlaceEntityDropLike = SpawnRequest & {
  type?: "entity";
};

export function mapDropPayloadToSpawnRequest(payload: PlaceEntityDropLike): SpawnRequest {
  return {
    entityId: payload.entityId,
    screenX: payload.screenX,
    screenY: payload.screenY,
  };
}
