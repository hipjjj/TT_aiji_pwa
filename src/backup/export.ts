import { db } from "../db";
import {
  buildScopedBackup,
  backupScopes,
  selectTravelSnapshot,
} from "./model.mjs";
export type BackupScope =
  | "all"
  | "bills"
  | "nutrition"
  | "fridge"
  | "travel"
  | "chat"
  | "personal";
export type TravelSelection = { kind: "domestic" | "overseas"; id: string };
export async function createBackup(
  scope: BackupScope,
  includePhotos: boolean,
  selection: TravelSelection | null = null,
) {
  if (!backupScopes.some((x) => x.id === scope))
    throw Error("请选择有效导出范围");
  if (selection && scope !== "travel")
    throw Error("单篇旅行只能在旅行册范围导出");
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
  const names = selection
    ? [selection.kind === "domestic" ? "trips" : "overseasTrips"]
    : scope === "all"
      ? [...new Set(Object.values(groups).flat())]
      : groups[scope];
  return db.transaction(
    "r",
    names.map((name) => db.table(name)),
    async () => {
      const data = Object.fromEntries(
        await Promise.all(
          names.map(async (name) => [
            name,
            selection
              ? [await db.table(name).get(selection.id)].filter(Boolean)
              : await db.table(name).toArray(),
          ]),
        ),
      );
      const snapshot = {
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
          data.chatGrowth?.find((x: { id: string }) => x.id === "main") || null,
      };
      return buildScopedBackup(
        selection ? selectTravelSnapshot(snapshot, selection) : snapshot,
        scope,
        includePhotos,
      );
    },
  );
}

export type TravelExportChoice = TravelSelection & {
  value: string;
  title: string;
  startDate: string;
  endDate: string;
};
export async function listTravelExportChoices(): Promise<TravelExportChoice[]> {
  return db.transaction("r", [db.trips, db.overseasTrips], async () => {
    const choices: TravelExportChoice[] = [];
    const add = (
      kind: TravelSelection["kind"],
      trip: { id: string; title: string; startDate: string; endDate: string },
    ) => {
      choices.push({
        kind,
        id: trip.id,
        value: JSON.stringify([kind, trip.id]),
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
      });
    };
    // Keep only titles/dates in memory; do not collect every diary's photo data.
    await Promise.all([
      db.trips.each((trip) => add("domestic", trip)),
      db.overseasTrips.each((trip) => add("overseas", trip)),
    ]);
    return choices.sort(
      (a, b) =>
        b.startDate.localeCompare(a.startDate) ||
        a.title.localeCompare(b.title, "zh-CN"),
    );
  });
}
