import type {
  ChatThread,
  ChatMessage,
  ChatMemory,
  ChatGrowth,
} from "./chat/types";
import Dexie, { type Table } from "dexie";
import { normalizeCategory } from "./model.mjs";
import type {
  AIConfiguration,
  Budget,
  Expense,
  Meal,
  NutritionProfile,
} from "./nutrition/types";
import type {
  FridgePreferences,
  InventoryItem,
  ShoppingItem,
} from "./fridge/types";
import type { Trip, VisitedCity, UserScenic } from "./travel/types";
export const db = new Dexie("riri-expenses") as Dexie & {
  chatThreads: Table<ChatThread, string>;
  chatMessages: Table<ChatMessage, string>;
  chatMemories: Table<ChatMemory, string>;
  chatGrowth: Table<ChatGrowth, string>;
  expenses: Table<Expense, string>;
  budgets: Table<Budget, string>;
  meals: Table<Meal, string>;
  nutritionProfiles: Table<NutritionProfile, string>;
  settings: Table<AIConfiguration, string>;
  inventory: Table<InventoryItem, string>;
  shopping: Table<ShoppingItem, string>;
  fridgePreferences: Table<FridgePreferences, string>;
  trips: Table<Trip, string>;
  visitedCities: Table<VisitedCity, string>;
  travelSpots: Table<UserScenic, string>;
};
db.version(1).stores({ expenses: "id,date,category" });
db.version(2)
  .stores({ expenses: "id,date,category" })
  .upgrade((tx) =>
    tx
      .table("expenses")
      .where("category")
      .equals("住房")
      .modify({ category: normalizeCategory("住房") }),
  );
db.version(3).stores({ expenses: "id,date,category", budgets: "month" });
db.version(4).stores({
  expenses: "id,date,category",
  budgets: "month",
  meals: "id,date,mealType,expenseId",
  nutritionProfiles: "id",
  settings: "id",
});
db.version(5).stores({
  expenses: "id,date,category",
  budgets: "month",
  meals: "id,date,mealType,expenseId",
  nutritionProfiles: "id",
  settings: "id",
  inventory: "id,location,expiry",
  shopping: "id,checked",
  fridgePreferences: "id",
});
db.version(6).stores({
  expenses: "id,date,category",
  budgets: "month",
  meals: "id,date,mealType,expenseId",
  nutritionProfiles: "id",
  settings: "id",
  inventory: "id,location,expiry",
  shopping: "id,checked",
  fridgePreferences: "id",
  trips: "id,startDate,endDate",
  visitedCities: "cityId,date",
  travelSpots: "id,cityId,grade",
});

db.version(7).stores({
  expenses: "id,date,category",
  budgets: "month",
  meals: "id,date,mealType,expenseId",
  nutritionProfiles: "id",
  settings: "id",
  inventory: "id,location,expiry",
  shopping: "id,checked",
  fridgePreferences: "id",
  trips: "id,startDate,endDate",
  visitedCities: "cityId,date",
  travelSpots: "id,cityId,grade",
  chatThreads: "id,updatedAt",
  chatMessages: "id,threadId,createdAt",
  chatMemories: "id,kind",
  chatGrowth: "id",
});
