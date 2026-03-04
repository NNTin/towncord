import Phaser from "phaser";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";

export const WORLD_SCENE_KEY = "world";
const PREFERRED_ANIMATION_KEY =
  "characters.bloomseed.player.female.tool.smash.smash-side";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super(WORLD_SCENE_KEY);
  }

  public create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add
      .text(width / 2, 24, "Towncord", {
        color: "#e2e8f0",
        fontFamily: "monospace",
        fontSize: "22px",
      })
      .setOrigin(0.5, 0);

    const rawAnimationKeys = this.registry.get(
      BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY,
    ) as unknown;

    const animationKeys = Array.isArray(rawAnimationKeys)
      ? rawAnimationKeys.filter((value): value is string => typeof value === "string")
      : [];

    if (animationKeys.length === 0) {
      this.add
        .text(width / 2, height / 2, "No animations were registered.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const firstAvailableAnimationKey = animationKeys[0];
    if (!firstAvailableAnimationKey) {
      this.add
        .text(width / 2, height / 2, "No playable animation keys found.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const animationKey = animationKeys.includes(PREFERRED_ANIMATION_KEY)
      ? PREFERRED_ANIMATION_KEY
      : firstAvailableAnimationKey;

    const animation = this.anims.get(animationKey);
    const firstFrame = animation?.frames[0];
    if (!firstFrame) {
      this.add
        .text(width / 2, height / 2, "Could not resolve animation frames.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const sprite = this.add.sprite(width / 2, height / 2, firstFrame.textureKey);
    sprite.setScale(4);
    sprite.play(animationKey);

    this.add
      .text(width / 2, height - 24, `Playing: ${animationKey}`, {
        color: "#cbd5e1",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(0.5, 1);
  }
}
