import { useMemo } from "react";
import {
  resolveEquipmentKey,
  resolveTrackForDirection,
  type AnimationTrack,
  type EquipmentId,
  type InputDirection,
  type Material,
  type SpriteDirection,
} from "../../../game/contracts/content";
import type {
  PreviewAnimationRequest,
  PreviewRuntimeInfo,
} from "../../../game/contracts/preview";
import type {
  TerrainTileInspectedPayload,
} from "../../../game/contracts/runtime";
import { usePreviewRuntime } from "../../game-session/hooks/usePreviewRuntime";

export type PreviewInfo = PreviewRuntimeInfo;

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

type Props = {
  track: AnimationTrack | null;
  direction: InputDirection;
  equipmentId: EquipmentId | "";
  material: Material;
  frameIndex: number | null;
  inspectedTile: TerrainTileInspectedPayload | null;
  onInfo: (info: PreviewInfo | null) => void;
};

function resolvePreviewAnimationPayload(args: {
  track: AnimationTrack | null;
  direction: InputDirection;
  equipmentId: EquipmentId | "";
  material: Material;
  frameIndex: number | null;
}): PreviewAnimationRequest | null {
  if (!args.track) {
    return null;
  }

  const result = resolveTrackForDirection(args.track, args.direction);
  if (!result) {
    return null;
  }

  const spriteDirection: SpriteDirection =
    args.direction === "left" || args.direction === "right"
      ? "side"
      : args.direction;
  const equipKey =
    args.equipmentId &&
    args.track.equipmentCompatible.includes(args.equipmentId as EquipmentId)
      ? resolveEquipmentKey(
          args.equipmentId as EquipmentId,
          args.material,
          spriteDirection,
        )
      : null;

  return {
    key: result.key,
    flipX: result.flipX,
    equipKey,
    equipFlipX: result.flipX,
    frameIndex: args.frameIndex,
  };
}

export function AnimationPreview({
  track,
  direction,
  equipmentId,
  material,
  frameIndex,
  inspectedTile,
  onInfo,
}: Props): JSX.Element {
  const previewAnimation = useMemo(
    () =>
      resolvePreviewAnimationPayload({
        track,
        direction,
        equipmentId,
        material,
        frameIndex,
      }),
    [direction, equipmentId, frameIndex, material, track],
  );
  const containerRef = usePreviewRuntime({
    previewTile: inspectedTile,
    previewAnimation,
    onInfo,
  });

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px solid var(--ui-border-muted)",
        borderRadius: 4,
        height: PREVIEW_HEIGHT,
        imageRendering: "pixelated",
        overflow: "hidden",
        width: PREVIEW_WIDTH,
      }}
    />
  );
}
