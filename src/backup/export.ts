import { db } from "../db";
import { buildScopedBackup, backupScopes } from "./model.mjs";
export type BackupScope =
  | "all"
  | "bills"
  | "nutrition"
  | "fridge"
  | "travel"
  | "chat"
  | "personal";
export async function createBackup(scope: BackupScope, includePhotos: boolean) {
  if (!backupScopes.some((x) => x.id === scope))
    throw Error("请选择有效导出范围");
  const groups = {
    bills: ["expenses", "budgets"],
    nutrition: ["meals", "nutritionProfiles", "personalFoods"],
    fridge: ["inventory", "shopping", "fridgePreferences"],
    travel: ["trips", "visitedCities", "travelSpots", "overseasTrips"],
    chat: [
      "chatThreads",
      "chatMessages",
      "chatMemories",
      "chatGrowth",
      "chatDrafts",
    ],
    personal: ["chatMemories", "chatGrowth"],
  };
  const names =
    scope === "all"
      ? [...new Set(Object.values(groups).flat())]
      : groups[scope];
  return db.transaction(
    "r",
    names.map((name) => db.table(name)),
    async () => {
      const data = Object.fromEntries(
        await Promise.all(
          names.map(async (name) => [name, await db.table(name).toArray()]),
        ),
      );
      return buildScopedBackup(
        {
          expenses: data.expenses,
          budgets: data.budgets,
          meals: data.meals,
          profile:
            data.nutritionProfiles?.find(
              (x: { id: string }) => x.id === "main",
            ) || null,
          personalFoods: data.personalFoods,
          inventory: data.inventory,
          shopping: data.shopping,
          preferences:
            data.fridgePreferences?.find(
              (x: { id: string }) => x.id === "main",
            ) || null,
          trips: data.trips,
          visitedCities: data.visitedCities,
          spots: data.travelSpots,
          overseasTrips: data.overseasTrips,
          threads: data.chatThreads,
          messages: data.chatMessages,
          drafts: data.chatDrafts,
          memories: data.chatMemories,
          growth:
            data.chatGrowth?.find((x: { id: string }) => x.id === "main") ||
            null,
        },
        scope,
        includePhotos,
      );
    },
  );
}
