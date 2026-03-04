import Phaser from "phaser";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";
import {
  type AnimationDirection,
  type AnimationGroups,
  parseAnimationGroups,
  resolveAnimation,
} from "../assets/animationGroups";

export const WORLD_SCENE_KEY = "world";

export class WorldScene extends Phaser.Scene {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private animationLabel: Phaser.GameObjects.Text | null = null;
  private animationGroups: AnimationGroups = new Map();
  private currentBaseType = "";
  private currentDirection: AnimationDirection = "right";
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null = null;

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

    const rawAnimationKeys = this.registry.get(BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY) as unknown;
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

    this.animationGroups = parseAnimationGroups(animationKeys);

    const sortedBaseTypes = [...this.animationGroups.keys()].sort();
    this.currentBaseType = sortedBaseTypes.includes("run") ? "run" : (sortedBaseTypes[0] ?? "");

    if (!this.currentBaseType) {
      this.add
        .text(width / 2, height / 2, "No playable animation keys found.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    // Create sprite with a placeholder texture key; will be set when animation plays
    const result = resolveAnimation(this.animationGroups, this.currentBaseType, this.currentDirection);
    if (!result) {
      this.add
        .text(width / 2, height / 2, "Could not resolve animation frames.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const animation = this.anims.get(result.key);
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

    this.sprite = this.add.sprite(width / 2, height / 2, firstFrame.textureKey);
    this.sprite.setScale(4);

    this.animationLabel = this.add
      .text(width / 2, height - 24, "", {
        color: "#cbd5e1",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(0.5, 1);

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;

    this.game.events.on("animationSelected", this.onAnimationSelected, this);
    this.events.once(
      "shutdown",
      () => this.game.events.off("animationSelected", this.onAnimationSelected, this),
      this,
    );

    this.playCurrentAnimation();
  }

  public update(): void {
    if (!this.wasd) return;

    let dir: AnimationDirection = this.currentDirection;
    if (this.wasd.W.isDown) dir = "up";
    else if (this.wasd.S.isDown) dir = "down";
    else if (this.wasd.D.isDown) dir = "right";
    else if (this.wasd.A.isDown) dir = "left";

    if (dir !== this.currentDirection) {
      this.currentDirection = dir;
      this.playCurrentAnimation();
    }
  }

  private playCurrentAnimation(): void {
    if (!this.sprite) return;
    const result = resolveAnimation(this.animationGroups, this.currentBaseType, this.currentDirection);
    if (!result) return;
    const { key, flipX } = result;
    this.sprite.setFlipX(flipX);
    this.sprite.play(key, true);
    this.animationLabel?.setText(`Playing: ${key}${flipX ? " (flipped)" : ""}`);
  }

  private onAnimationSelected(baseType: string): void {
    this.currentBaseType = baseType;
    this.playCurrentAnimation();
  }
}
