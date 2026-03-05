import type { SpriteDirection } from "./animationGroups";

export type EquipmentId =
  | "axe"
  | "hoe"
  | "pickaxe"
  | "sickle"
  | "watering-can"
  | "sword-slash"
  | "sword-stab";

export type Material = "gold" | "iron" | "wood";

export const MATERIALS: Material[] = ["gold", "iron", "wood"];

/** Maps tool-* baseType → which equipment IDs are compatible */
export const TOOL_EQUIPMENT_MAP: Record<string, EquipmentId[]> = {
  "tool-slash": ["sword-slash", "sickle"],
  "tool-smash": ["axe", "hoe", "pickaxe"],
  "tool-stab": ["sword-stab"],
  "tool-watering": ["watering-can"],
};

export function getCompatibleEquipment(baseType: string): EquipmentId[] {
  return TOOL_EQUIPMENT_MAP[baseType] ?? [];
}

export function resolveEquipmentKey(
  equipmentId: EquipmentId,
  material: Material,
  dir: SpriteDirection,
): string {
  switch (equipmentId) {
    case "axe":
      return `equipment.bloomseed.tools.axe-${material}-${dir}`;
    case "hoe":
      return `equipment.bloomseed.tools.hoe-${material}-${dir}`;
    case "pickaxe":
      return `equipment.bloomseed.tools.pickaxe-${material}-${dir}`;
    case "sickle":
      return `equipment.bloomseed.tools.sickle.sickle-${material}-${dir}`;
    case "watering-can":
      return `equipment.bloomseed.tools.watering-can.watering-can-${material}-${dir}`;
    case "sword-slash":
      return `equipment.bloomseed.weapons.sword.sword-slash.sword-slash-${material}-${dir}`;
    case "sword-stab":
      return `equipment.bloomseed.weapons.sword.sword-stab.sword-stab-${material}-${dir}`;
  }
}
