import Phaser from "phaser";
import { preloadBloomseedPack, preloadDebugPack } from "../assets/preload";
import { registerBloomseedAnimations } from "../assets/animation";
import {
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
  type PreviewAnimationRequest,
  type PreviewRuntimeInfo,
  type PreviewTileRequest,
} from "../previewRuntimeContract";

const PREVIEW_SCENE_KEY = "preview";

const EQUIPMENT_ATLAS = "bloomseed.equipment";

const PREVIEW_SCALE = 3;

export class PreviewScene extends Phaser.Scene {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private equipSprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super(PREVIEW_SCENE_KEY);
  }

  preload(): void {
    preloadBloomseedPack(this);
    preloadDebugPack(this);
  }

  create(): void {
    registerBloomseedAnimations(this);

    this.game.events.on(PREVIEW_PLAY_EVENT, this.onPlay, this);
    this.game.events.on(PREVIEW_SHOW_TILE_EVENT, this.onShowTile, this);
    this.events.once("shutdown", () => {
      this.game.events.off(PREVIEW_PLAY_EVENT, this.onPlay, this);
      this.game.events.off(PREVIEW_SHOW_TILE_EVENT, this.onShowTile, this);
    });

    this.game.events.emit(PREVIEW_READY_EVENT);
  }

  private getPreviewCenter(): { x: number; y: number } {
    return {
      x: Math.round(this.scale.width / 2),
      y: Math.round(this.scale.height / 2),
    };
  }

  private ensurePreviewSprite(
    textureKey: string,
    textureFrame: string | number,
    syncTexture: boolean,
  ): Phaser.GameObjects.Sprite {
    const { x, y } = this.getPreviewCenter();

    if (!this.sprite) {
      this.sprite = this.add.sprite(x, y, textureKey, textureFrame);
      this.sprite.setScale(PREVIEW_SCALE);
      return this.sprite;
    }

    if (syncTexture) {
      this.sprite.setTexture(textureKey, textureFrame);
    }

    this.sprite.setPosition(x, y);
    return this.sprite;
  }

  private onPlay(payload: PreviewAnimationRequest): void {
    const { key, flipX, equipKey, equipFlipX, frameIndex } = payload;

    const animation = this.anims.get(key);
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

    const previewSprite = this.ensurePreviewSprite(
      selectedAnimationFrame.textureKey,
      selectedAnimationFrame.textureFrame,
      resolvedFrameIndex !== null,
    );
    const { x: centerX, y: centerY } = this.getPreviewCenter();

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
      this.anims.exists(equipKey)
    ) {
      if (!this.equipSprite) {
        this.equipSprite = this.add.sprite(centerX, centerY, EQUIPMENT_ATLAS);
        this.equipSprite.setScale(PREVIEW_SCALE);
      }
      this.equipSprite.setFlipX(equipFlipX);
      this.equipSprite.setVisible(true);
      this.equipSprite.play(equipKey, false);
    } else if (this.equipSprite) {
      this.equipSprite.setVisible(false);
    }

    const texture = this.textures.get(selectedAnimationFrame.textureKey);
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
    this.game.events.emit(PREVIEW_INFO_EVENT, info);
  }

  private onShowTile(payload: PreviewTileRequest): void {
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
    if (!this.textures.exists(textureKey)) return;

    const texture = this.textures.get(textureKey);
    const resolvedFrame = texture.get(frame);
    if (!resolvedFrame) return;

    const previewSprite = this.ensurePreviewSprite(textureKey, frame, true);
    previewSprite.setFlip(flipX, flipY);
    previewSprite.setRotation(rotate90 * (Math.PI / 2));
    previewSprite.setScale(PREVIEW_SCALE);
    previewSprite.stop();

    if (this.equipSprite) {
      this.equipSprite.setVisible(false);
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
    this.game.events.emit(PREVIEW_INFO_EVENT, info);
  }
}
