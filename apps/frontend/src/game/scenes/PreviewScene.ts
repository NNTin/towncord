import Phaser from "phaser";
import { preloadBloomseedPack } from "../assets/preload";
import { registerBloomseedAnimations } from "../assets/animation";

export const PREVIEW_SCENE_KEY = "preview";

// Internal events for the preview game instance (not shared with main game)
export const PREVIEW_READY_EVENT = "preview:ready";
export const PREVIEW_PLAY_EVENT = "preview:play";
export const PREVIEW_INFO_EVENT = "preview:info";

const EQUIPMENT_ATLAS = "bloomseed.equipment";

export const PREVIEW_SCALE = 3;

export type PreviewPlayPayload = {
  key: string;
  flipX: boolean;
  equipKey: string | null;
  equipFlipX: boolean;
};

export type PreviewInfo = {
  animationKey: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  flipX: boolean;
  scale: number;
  displayWidth: number;
  displayHeight: number;
};

export class PreviewScene extends Phaser.Scene {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private equipSprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super(PREVIEW_SCENE_KEY);
  }

  preload(): void {
    preloadBloomseedPack(this);
  }

  create(): void {
    registerBloomseedAnimations(this);

    this.game.events.on(PREVIEW_PLAY_EVENT, this.onPlay, this);
    this.events.once("shutdown", () => {
      this.game.events.off(PREVIEW_PLAY_EVENT, this.onPlay, this);
    });

    this.game.events.emit(PREVIEW_READY_EVENT);
  }

  private onPlay(payload: PreviewPlayPayload): void {
    const { key, flipX, equipKey, equipFlipX } = payload;

    const animation = this.anims.get(key);
    const firstFrame = animation?.frames[0];
    if (!animation || !firstFrame) return;

    const cx = Math.round(this.scale.width / 2);
    const cy = Math.round(this.scale.height / 2);

    if (!this.sprite) {
      this.sprite = this.add.sprite(cx, cy, firstFrame.textureKey);
      this.sprite.setScale(PREVIEW_SCALE);
    }

    this.sprite.setFlipX(flipX);
    this.sprite.play(key, false);

    if (equipKey && this.anims.exists(equipKey)) {
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

    const texture = this.textures.get(firstFrame.textureKey);
    const frame = texture.get(firstFrame.textureFrame);
    if (!frame) return;

    const info: PreviewInfo = {
      animationKey: key,
      frameWidth: frame.width,
      frameHeight: frame.height,
      frameCount: animation.frames.length,
      flipX,
      scale: PREVIEW_SCALE,
      displayWidth: Math.round(PREVIEW_SCALE * frame.width),
      displayHeight: Math.round(PREVIEW_SCALE * frame.height),
    };
    this.game.events.emit(PREVIEW_INFO_EVENT, info);
  }
}
