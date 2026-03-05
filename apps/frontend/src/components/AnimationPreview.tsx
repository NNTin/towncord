import { useEffect, useRef } from "react";
import Phaser from "phaser";
import {
  type AnimationTrack,
  type InputDirection,
  type SpriteDirection,
  resolveTrackForDirection,
} from "../game/assets/animationCatalog";
import { type EquipmentId, type Material, resolveEquipmentKey } from "../game/assets/equipmentGroups";
import {
  PreviewScene,
  PREVIEW_READY_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_INFO_EVENT,
  type PreviewPlayPayload,
  type PreviewInfo,
} from "../game/scenes/PreviewScene";

export type { PreviewInfo };

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

type Props = {
  track: AnimationTrack | null;
  direction: InputDirection;
  equipmentId: EquipmentId | "";
  material: Material;
  onInfo: (info: PreviewInfo | null) => void;
};

export function AnimationPreview({
  track,
  direction,
  equipmentId,
  material,
  onInfo,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<PreviewPlayPayload | null>(null);
  // Ref keeps the callback fresh inside the game event listener
  const onInfoRef = useRef(onInfo);
  onInfoRef.current = onInfo;

  // Create the preview Phaser game once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      backgroundColor: "#0f172a",
      parent: container,
      scene: [PreviewScene],
      input: { keyboard: false },
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.NONE },
      disableContextMenu: true,
    });
    gameRef.current = game;

    game.events.once(PREVIEW_READY_EVENT, () => {
      readyRef.current = true;
      if (pendingRef.current) {
        game.events.emit(PREVIEW_PLAY_EVENT, pendingRef.current);
        pendingRef.current = null;
      }
    });

    game.events.on(PREVIEW_INFO_EVENT, (info: PreviewInfo) => {
      onInfoRef.current(info);
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
      readyRef.current = false;
      pendingRef.current = null;
    };
  }, []);

  // Re-resolve and emit whenever selection props change
  useEffect(() => {
    if (!track) {
      onInfoRef.current(null);
      return;
    }

    const result = resolveTrackForDirection(track, direction);
    if (!result) return;

    const spriteDir: SpriteDirection =
      direction === "left" || direction === "right" ? "side" : direction;

    const equipKey =
      equipmentId && track.equipmentCompatible.includes(equipmentId as EquipmentId)
        ? resolveEquipmentKey(equipmentId as EquipmentId, material, spriteDir)
        : null;

    const payload: PreviewPlayPayload = {
      key: result.key,
      flipX: result.flipX,
      equipKey,
      equipFlipX: result.flipX,
    };

    if (readyRef.current && gameRef.current) {
      gameRef.current.events.emit(PREVIEW_PLAY_EVENT, payload);
    } else {
      pendingRef.current = payload;
    }
  }, [track, direction, equipmentId, material]);

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        height: PREVIEW_HEIGHT,
        overflow: "hidden",
        width: PREVIEW_WIDTH,
      }}
    />
  );
}
