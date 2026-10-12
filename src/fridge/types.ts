export type StoragePlace = "冷藏" | "冷冻" | "常温";
export type InventoryItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  location: StoragePlace;
  expiry: string | null;
  note: string;
  updatedAt: number;
};
export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  note: string;
  recipeName: string;
  checked: boolean;
  stocked: boolean;
  updatedAt: number;
};
export type FridgePreferences = {
  id: "main";
  servings: number;
  maxMinutes: number;
  allergies: string;
  avoid: string;
  preference: "不限" | "减脂" | "高蛋白";
  showNutrition: boolean;
  pantry: string[];
};
export type RecipeIngredient = {
  name: string;
  amount: number;
  unit: string;
  foodId?: string;
  gramsPerUnit?: number;
  per100?: import("../nutrition/types").Nutrients;
  pantry?: boolean;
  optional?: boolean;
};
export type Recipe = {
  id: string;
  name: string;
  emoji: string;
  servings: number;
  minutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  source: "library" | "ai";
  note: string;
};
export type StockUpdate = {
  id: string;
  quantity: string;
  unit: string;
  action: "keep" | "update" | "used";
};
