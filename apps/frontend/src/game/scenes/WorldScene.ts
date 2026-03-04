import Phaser from "phaser";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";

export const WORLD_SCENE_KEY = "world";

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

    const firstAnimationKey = animationKeys[0];
    if (!firstAnimationKey) {
      this.add
        .text(width / 2, height / 2, "No animations were registered.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const sprite = this.add.sprite(width / 2, height / 2, "bloomseed.characters");
    sprite.setScale(4);
    sprite.play(firstAnimationKey);

    this.add
      .text(width / 2, height - 24, `Playing: ${firstAnimationKey}`, {
        color: "#cbd5e1",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(0.5, 1);
  }
}
