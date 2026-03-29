const EXCLUSIVE_OVERLAP_CATEGORIES = new Set(["chairs", "desks"]);

export type FurniturePlacementLike = {
  placement: string;
  category: string;
};

export function shouldTreatFurnitureOverlapAsExclusive(
  candidateCategory: string,
  existingCategory: string,
): boolean {
  return EXCLUSIVE_OVERLAP_CATEGORIES.has(candidateCategory) || candidateCategory === existingCategory;
}

export function doesFurnitureBlockMovement(furniture: FurniturePlacementLike): boolean {
  return furniture.placement === "floor" && furniture.category !== "chairs";
}
