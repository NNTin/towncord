import type {
  PreviewAnimationRequest,
  PreviewRuntimeInfo,
  PreviewTileRequest,
} from "../../contracts/preview";
import type { TerrainTileInspectedPayload } from "../../contracts/runtime";

type PreviewRuntimeSession = {
  showAnimation: (payload: PreviewAnimationRequest) => void;
  showTile: (payload: PreviewTileRequest) => void;
};

type PreviewRuntimeSessionRef = {
  current: PreviewRuntimeSession | null;
};

function toPreviewTilePayload(
  inspectedTile: TerrainTileInspectedPayload,
): PreviewTileRequest {
  return {
    textureKey: inspectedTile.textureKey,
    frame: inspectedTile.frame,
    caseId: inspectedTile.caseId,
    materialId: inspectedTile.materialId,
    cellX: inspectedTile.cellX,
    cellY: inspectedTile.cellY,
    rotate90: inspectedTile.rotate90,
    flipX: inspectedTile.flipX,
    flipY: inspectedTile.flipY,
  };
}

export function createPreviewRuntimeAdapter(args: {
  onInfo: (info: PreviewRuntimeInfo | null) => void;
  sessionRef: PreviewRuntimeSessionRef;
}): {
  showPreviewAnimation: (
    previewAnimation: PreviewAnimationRequest | null,
    previewTile: TerrainTileInspectedPayload | null,
  ) => void;
  showPreviewTile: (previewTile: TerrainTileInspectedPayload | null) => void;
} {
  return {
    showPreviewAnimation(previewAnimation, previewTile) {
      if (previewTile) {
        return;
      }

      if (!previewAnimation) {
        args.onInfo(null);
        return;
      }

      args.sessionRef.current?.showAnimation(previewAnimation);
    },
    showPreviewTile(previewTile) {
      if (!previewTile) {
        return;
      }

      args.sessionRef.current?.showTile(toPreviewTilePayload(previewTile));
    },
  };
}
