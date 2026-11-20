import {emptyTeaching,validateTeaching} from '../teaching/model.mjs';
import {blobDataURL} from '../teaching/store';
import {emptyStudy,studyKey,validateStudy} from '../study/model.mjs';
import { db } from "../db";
import {
  buildScopedBackup,
  backupScopes,
  selectTravelSnapshot,
} from "./model.mjs";
export type BackupScope =
  | "teaching"
  | "study"
  | "grading"
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
  includeTeachingPDF=false,
) {
  if (!backupScopes.some((x) => x.id === scope))
    throw Error("请选择有效导出范围");
  if (selection && scope !== "travel")
    throw Error("单篇旅行只能在旅行册范围导出");
  const groups = {
    teaching:["teachingState",...(includeTeachingPDF?["teachingFiles"]:[])],
    study:["appMeta"],
    grading: ["examGrades", "gradingSettings"],
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
  let teachingFiles:{id:string;name:string;blob:Blob}[]=[];
  const result=await db.transaction(
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
      const studyRow=data.appMeta?.find((x:{id:string})=>x.id===studyKey);
      teachingFiles=data.teachingFiles||[];
      const snapshot = {
        teaching:data.teachingState?{state:validateTeaching(data.teachingState.find((x:{id:string})=>x.id==='main')?.state||emptyTeaching()),files:[],filesIncluded:includeTeachingPDF}:undefined,
        study: data.appMeta ? (studyRow ? validateStudy(JSON.parse(String(studyRow.value))) : emptyStudy()) : undefined,
        examGrades: data.examGrades,
        gradingSettings:
          data.gradingSettings?.find((x: { id: string }) => x.id === "main") ||
          null,
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
  if(result.teaching&&includeTeachingPDF)result.teaching.files=await Promise.all(teachingFiles.map(async f=>({id:f.id,name:f.name,dataURL:await blobDataURL(f.blob)})));
  return result;
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
