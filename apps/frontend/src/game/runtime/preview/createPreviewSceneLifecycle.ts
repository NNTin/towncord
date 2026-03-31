import Phaser from "phaser";
import type { PreviewSceneLifecycleAdapter } from "../../../engine";
import {
  preloadBloomseedPack,
  preloadDebugPack,
  preloadFarmrpgPack,
} from "../../content/preload/preload";
import {
  registerBloomseedAnimations,
  registerFarmrpgAnimations,
} from "../../content/preload/animation";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
  type PreviewAnimationRequest,
  type PreviewRuntimeInfo,
} from "../transport/previewEvents";
import type { PreviewTileRequest } from "../../contracts/preview";

const EQUIPMENT_ATLAS = "bloomseed.equipment";
const PREVIEW_SCALE = 3;

/**
 * Creates the game-owned preview lifecycle adapter for the preview runtime.
 *
 * This adapter is the single owner of preview runtime semantics that previously
 * lived inside PreviewScene.ts. It owns:
 * - preview asset preload (bloomseed and debug packs)
 * - preview animation registration
 * - preview event binding and unbinding
 * - preview sprite and equipment sprite lifecycle
 * - preview info payload emission
 * - preview-ready emission
 *
 * The engine-owned preview scene shell calls adapter.preload(), adapter.create(),
 * and adapter.dispose() from the correct Phaser lifecycle phases.
 */
export function createPreviewSceneLifecycle(): PreviewSceneLifecycleAdapter {
  let sprite: Phaser.GameObjects.Sprite | null = null;
  let equipSprite: Phaser.GameObjects.Sprite | null = null;
  let unbindPlay: (() => void) | null = null;
  let unbindShowTile: (() => void) | null = null;

  function getPreviewCenter(scene: Phaser.Scene): { x: number; y: number } {
    return {
      x: Math.round(scene.scale.width / 2),
      y: Math.round(scene.scale.height / 2),
    };
  }

  function ensurePreviewSprite(
    scene: Phaser.Scene,
    textureKey: string,
    textureFrame: string | number,
    syncTexture: boolean,
  ): Phaser.GameObjects.Sprite {
    const { x, y } = getPreviewCenter(scene);

    if (!sprite) {
      sprite = scene.add.sprite(x, y, textureKey, textureFrame);
      sprite.setScale(PREVIEW_SCALE);
      return sprite;
    }

    if (syncTexture) {
      sprite.setTexture(textureKey, textureFrame);
    }

    sprite.setPosition(x, y);
    return sprite;
  }

  function onPlay(scene: Phaser.Scene, payload: PreviewAnimationRequest): void {
    const { key, flipX, equipKey, equipFlipX, frameIndex } = payload;

    const animation = scene.anims.get(key);
    const firstFrame = animation?.frames[0];
    if (!animation || !firstFrame) return;

    const resolvedFrameIndex =
      typeof frameIndex === "number" && Number.isFinite(frameIndex)
        ? Phaser.Math.Clamp(
            Math.floor(frameIndex),
            0,
            animation.frames.length - 1,
          )
        : null;
    const selectedAnimationFrame =
      resolvedFrameIndex === null
        ? firstFrame
        : animation.frames[resolvedFrameIndex];
    if (!selectedAnimationFrame) return;

    const previewSprite = ensurePreviewSprite(
      scene,
      selectedAnimationFrame.textureKey,
      selectedAnimationFrame.textureFrame,
      resolvedFrameIndex !== null,
    );
    const { x: centerX, y: centerY } = getPreviewCenter(scene);

    previewSprite.setFlip(flipX, false);
    previewSprite.setRotation(0);
    if (resolvedFrameIndex === null) {
      previewSprite.play(key, false);
    } else {
      previewSprite.stop();
    }

    if (
      resolvedFrameIndex === null &&
      equipKey &&
      scene.anims.exists(equipKey)
    ) {
      if (!equipSprite) {
        equipSprite = scene.add.sprite(centerX, centerY, EQUIPMENT_ATLAS);
        equipSprite.setScale(PREVIEW_SCALE);
      }
      equipSprite.setFlipX(equipFlipX);
      equipSprite.setVisible(true);
      equipSprite.play(equipKey, false);
    } else if (equipSprite) {
      equipSprite.setVisible(false);
    }

    const texture = scene.textures.get(selectedAnimationFrame.textureKey);
    const frame = texture.get(selectedAnimationFrame.textureFrame);
    if (!frame) return;

    const info: PreviewRuntimeInfo = {
      sourceType: "animation",
      animationKey: key,
      frameWidth: frame.width,
      frameHeight: frame.height,
      frameCount: animation.frames.length,
      flipX,
      flipY: false,
      scale: PREVIEW_SCALE,
      displayWidth: Math.round(PREVIEW_SCALE * frame.width),
      displayHeight: Math.round(PREVIEW_SCALE * frame.height),
    };
    scene.game.events.emit(PREVIEW_INFO_EVENT, info);
  }

  function onShowTile(scene: Phaser.Scene, payload: PreviewTileRequest): void {
    const {
      textureKey,
      frame,
      caseId,
      materialId,
      cellX,
      cellY,
      rotate90,
      flipX,
      flipY,
    } = payload;
    if (!scene.textures.exists(textureKey)) return;

    const texture = scene.textures.get(textureKey);
    const resolvedFrame = texture.get(frame);
    if (!resolvedFrame) return;

    const previewSprite = ensurePreviewSprite(scene, textureKey, frame, true);
    previewSprite.setFlip(flipX, flipY);
    previewSprite.setRotation(rotate90 * (Math.PI / 2));
    previewSprite.setScale(PREVIEW_SCALE);
    previewSprite.stop();

    if (equipSprite) {
      equipSprite.setVisible(false);
    }

    const info: PreviewRuntimeInfo = {
      sourceType: "terrain-tile",
      animationKey: frame,
      frameWidth: resolvedFrame.width,
      frameHeight: resolvedFrame.height,
      frameCount: 1,
      flipX,
      flipY,
      scale: PREVIEW_SCALE,
      displayWidth: Math.round(PREVIEW_SCALE * resolvedFrame.width),
      displayHeight: Math.round(PREVIEW_SCALE * resolvedFrame.height),
      caseId,
      materialId,
      cellX,
      cellY,
      rotate90,
    };
    scene.game.events.emit(PREVIEW_INFO_EVENT, info);
  }

  return {
    preload(scene: Phaser.Scene): void {
      preloadBloomseedPack(scene);
      try {
        preloadFarmrpgPack(scene);
      } catch {
        // FarmRPG pack is optional in preview; ignore if missing or invalid.
      }
      preloadDebugPack(scene);
    },

    create(scene: Phaser.Scene): void {
      registerBloomseedAnimations(scene);
      try {
        registerFarmrpgAnimations(scene);
      } catch {
        // FarmRPG animations are optional in preview; ignore if manifest is missing or invalid.
      }

      const handlePlay = (payload: PreviewAnimationRequest): void => {
        onPlay(scene, payload);
      };
      const handleShowTile = (payload: PreviewTileRequest): void => {
        onShowTile(scene, payload);
      };

      scene.game.events.on(PREVIEW_PLAY_EVENT, handlePlay);
      scene.game.events.on(PREVIEW_SHOW_TILE_EVENT, handleShowTile);

      unbindPlay = (): void => {
        scene.game.events.off(PREVIEW_PLAY_EVENT, handlePlay);
      };
      unbindShowTile = (): void => {
        scene.game.events.off(PREVIEW_SHOW_TILE_EVENT, handleShowTile);
      };

      scene.game.events.emit(PREVIEW_READY_EVENT);
    },

    dispose(): void {
      unbindPlay?.();
      unbindShowTile?.();
      unbindPlay = null;
      unbindShowTile = null;
      sprite = null;
      equipSprite = null;
    },
  };
}
