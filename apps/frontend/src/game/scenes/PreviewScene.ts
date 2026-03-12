import Phaser from "phaser";
import { preloadBloomseedPack, preloadDebugPack } from "../assets/preload";
import { registerBloomseedAnimations } from "../assets/animation";

const PREVIEW_SCENE_KEY = "preview";

// Internal events for the preview game instance (not shared with main game)
export const PREVIEW_READY_EVENT = "preview:ready";
export const PREVIEW_PLAY_EVENT = "preview:play";
export const PREVIEW_SHOW_TILE_EVENT = "preview:showTile";
export const PREVIEW_INFO_EVENT = "preview:info";

const EQUIPMENT_ATLAS = "bloomseed.equipment";

const PREVIEW_SCALE = 3;

export type PreviewPlayPayload = {
  key: string;
  flipX: boolean;
  equipKey: string | null;
  equipFlipX: boolean;
  frameIndex?: number | null;
};

export type PreviewShowTilePayload = {
  textureKey: string;
  frame: string;
  caseId: number;
  materialId: string;
  cellX: number;
  cellY: number;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type PreviewInfo = {
  sourceType: "animation" | "terrain-tile";
  animationKey: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  flipX: boolean;
  flipY: boolean;
  scale: number;
  displayWidth: number;
  displayHeight: number;
  caseId?: number;
  materialId?: string;
  cellX?: number;
  cellY?: number;
  rotate90?: 0 | 1 | 2 | 3;
};

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

  private onPlay(payload: PreviewPlayPayload): void {
    const { key, flipX, equipKey, equipFlipX, frameIndex } = payload;

    const animation = this.anims.get(key);
    const firstFrame = animation?.frames[0];
    if (!animation || !firstFrame) return;

    const cx = Math.round(this.scale.width / 2);
    const cy = Math.round(this.scale.height / 2);

    if (!this.sprite) {
      this.sprite = this.add.sprite(cx, cy, firstFrame.textureKey, firstFrame.textureFrame);
      this.sprite.setScale(PREVIEW_SCALE);
    }

    const resolvedFrameIndex =
      typeof frameIndex === "number" && Number.isFinite(frameIndex)
        ? Phaser.Math.Clamp(Math.floor(frameIndex), 0, animation.frames.length - 1)
        : null;
    const selectedAnimationFrame =
      resolvedFrameIndex === null ? firstFrame : animation.frames[resolvedFrameIndex];
    if (!selectedAnimationFrame) return;

    this.sprite.setFlip(flipX, false);
    this.sprite.setRotation(0);
    if (resolvedFrameIndex === null) {
      this.sprite.play(key, false);
    } else {
      this.sprite.setTexture(selectedAnimationFrame.textureKey, selectedAnimationFrame.textureFrame);
      this.sprite.setPosition(cx, cy);
      this.sprite.stop();
    }

    if (resolvedFrameIndex === null && equipKey && this.anims.exists(equipKey)) {
      if (!this.equipSprite) {
        this.equipSprite = this.add.sprite(cx, cy, EQUIPMENT_ATLAS);
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

    const info: PreviewInfo = {
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

  private onShowTile(payload: PreviewShowTilePayload): void {
    const { textureKey, frame, caseId, materialId, cellX, cellY, rotate90, flipX, flipY } = payload;
    if (!this.textures.exists(textureKey)) return;

    const texture = this.textures.get(textureKey);
    const resolvedFrame = texture.get(frame);
    if (!resolvedFrame) return;

    const cx = Math.round(this.scale.width / 2);
    const cy = Math.round(this.scale.height / 2);

    if (!this.sprite) {
      this.sprite = this.add.sprite(cx, cy, textureKey, frame);
      this.sprite.setScale(PREVIEW_SCALE);
    } else {
      this.sprite.setTexture(textureKey, frame);
      this.sprite.setPosition(cx, cy);
    }

    this.sprite.setFlip(flipX, flipY);
    this.sprite.setRotation(rotate90 * (Math.PI / 2));
    this.sprite.setScale(PREVIEW_SCALE);
    this.sprite.stop();

    if (this.equipSprite) {
      this.equipSprite.setVisible(false);
    }

    const info: PreviewInfo = {
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
