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
  PREVIEW_SHOW_TILE_EVENT,
  PREVIEW_INFO_EVENT,
  type PreviewPlayPayload,
  type PreviewShowTilePayload,
  type PreviewInfo,
} from "../game/scenes/PreviewScene";
import type { TerrainTileInspectedPayload } from "../game/events";

export type { PreviewInfo };

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

type Props = {
  track: AnimationTrack | null;
  direction: InputDirection;
  equipmentId: EquipmentId | "";
  material: Material;
  inspectedTile: TerrainTileInspectedPayload | null;
  onInfo: (info: PreviewInfo | null) => void;
};

export function AnimationPreview({
  track,
  direction,
  equipmentId,
  material,
  inspectedTile,
  onInfo,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const readyRef = useRef(false);
  const pendingPlayRef = useRef<PreviewPlayPayload | null>(null);
  const pendingTileRef = useRef<PreviewShowTilePayload | null>(null);
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
      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        antialiasGL: false,
      },
    });
    gameRef.current = game;

    game.events.once(PREVIEW_READY_EVENT, () => {
      readyRef.current = true;
      if (pendingTileRef.current) {
        game.events.emit(PREVIEW_SHOW_TILE_EVENT, pendingTileRef.current);
        pendingTileRef.current = null;
      } else if (pendingPlayRef.current) {
        game.events.emit(PREVIEW_PLAY_EVENT, pendingPlayRef.current);
        pendingPlayRef.current = null;
      }
    });

    game.events.on(PREVIEW_INFO_EVENT, (info: PreviewInfo) => {
      onInfoRef.current(info);
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
      readyRef.current = false;
      pendingPlayRef.current = null;
      pendingTileRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!inspectedTile) return;

    const payload: PreviewShowTilePayload = {
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

    if (readyRef.current && gameRef.current) {
      gameRef.current.events.emit(PREVIEW_SHOW_TILE_EVENT, payload);
    } else {
      pendingTileRef.current = payload;
    }
  }, [inspectedTile]);

  // Re-resolve and emit whenever selection props change
  useEffect(() => {
    if (inspectedTile) {
      return;
    }

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
      pendingPlayRef.current = payload;
    }
  }, [track, direction, equipmentId, material, inspectedTile]);

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        height: PREVIEW_HEIGHT,
        imageRendering: "pixelated",
        overflow: "hidden",
        width: PREVIEW_WIDTH,
      }}
    />
  );
}
