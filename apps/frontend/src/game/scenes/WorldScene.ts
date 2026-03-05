import Phaser from "phaser";
import { BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY } from "./PreloadScene";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type InputDirection,
  type SpriteDirection,
  buildAnimationCatalog,
  getTracksForPath,
  resolveTrackForDirection,
} from "../assets/animationCatalog";
import { type EquipmentId, type Material, resolveEquipmentKey } from "../assets/equipmentGroups";

export const WORLD_SCENE_KEY = "world";

const EQUIPMENT_ATLAS = "bloomseed.equipment";

export class WorldScene extends Phaser.Scene {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private equipmentSprite: Phaser.GameObjects.Sprite | null = null;
  private animationLabel: Phaser.GameObjects.Text | null = null;
  private catalog: AnimationCatalog | null = null;
  private currentTrack: AnimationTrack | null = null;
  private currentDirection: InputDirection = "right";
  private currentEquipmentId: EquipmentId | "" = "";
  private currentMaterial: Material = "iron";
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

    this.catalog = buildAnimationCatalog(animationKeys);

    // Find initial default track: player/female/run, or first available
    const playerModel = this.catalog.playerModels[0] ?? "female";
    const playerTracks = getTracksForPath(this.catalog, `player/${playerModel}`);
    this.currentTrack = playerTracks.find((t) => t.id === "run") ?? playerTracks[0] ?? null;

    if (!this.currentTrack) {
      this.add
        .text(width / 2, height / 2, "No playable animation keys found.", {
          color: "#f8fafc",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setOrigin(0.5);
      return;
    }

    const result = resolveTrackForDirection(this.currentTrack, this.currentDirection);
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

    // Equipment sprite sits on top of the character sprite, same position/scale
    this.equipmentSprite = this.add.sprite(width / 2, height / 2, EQUIPMENT_ATLAS);
    this.equipmentSprite.setScale(4);
    this.equipmentSprite.setVisible(false);

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
    this.game.events.on("equipmentSelected", this.onEquipmentSelected, this);
    this.events.once(
      "shutdown",
      () => {
        this.game.events.off("animationSelected", this.onAnimationSelected, this);
        this.game.events.off("equipmentSelected", this.onEquipmentSelected, this);
      },
      this,
    );

    this.playCurrentAnimation();
  }

  public update(): void {
    if (!this.wasd) return;

    let dir: InputDirection = this.currentDirection;
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
    if (!this.sprite || !this.currentTrack) return;

    const result = resolveTrackForDirection(this.currentTrack, this.currentDirection);
    if (!result) return;
    const { key, flipX } = result;

    this.sprite.setFlipX(flipX);
    this.sprite.play(key, false);

    // Equipment overlay
    const spriteDir: SpriteDirection =
      this.currentDirection === "left" || this.currentDirection === "right"
        ? "side"
        : this.currentDirection;
    const compatible = this.currentTrack.equipmentCompatible;

    if (
      this.equipmentSprite &&
      this.currentEquipmentId &&
      compatible.includes(this.currentEquipmentId)
    ) {
      const equipKey = resolveEquipmentKey(this.currentEquipmentId, this.currentMaterial, spriteDir);
      if (this.anims.exists(equipKey)) {
        this.equipmentSprite.setFlipX(flipX);
        this.equipmentSprite.setVisible(true);
        this.equipmentSprite.play(equipKey, false);
      } else {
        this.equipmentSprite.setVisible(false);
      }
    } else if (this.equipmentSprite) {
      this.equipmentSprite.setVisible(false);
    }

    this.animationLabel?.setText(`Playing: ${key}${flipX ? " (flipped)" : ""}`);
  }

  private onAnimationSelected(track: AnimationTrack): void {
    this.currentTrack = track;
    this.playCurrentAnimation();
  }

  private onEquipmentSelected(payload: { equipmentId: EquipmentId; material: Material }): void {
    this.currentEquipmentId = payload.equipmentId;
    this.currentMaterial = payload.material;
    this.playCurrentAnimation();
  }
}
