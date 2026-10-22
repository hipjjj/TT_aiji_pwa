export const backupScopes = [
  {
    id: "all",
    label: "全部数据",
    description: "账单、营养、食物库、冰箱、旅行、聊天和记忆。",
  },
  { id: "bills", label: "账单", description: "账单明细与每月预算。" },
  {
    id: "nutrition",
    label: "营养屋",
    description:
      "饮食、营养目标和我的食物库；不包含关联账单，新设备导入后不保留账单关联。",
  },
  {
    id: "fridge",
    label: "嘟嘟冰箱",
    description: "食材库存、购物清单及冰箱偏好。",
  },
  {
    id: "travel",
    label: "旅行册",
    description: "国内与海外旅行、足迹、景点及游记。",
  },
  {
    id: "chat",
    label: "企鹅小家",
    description: "聊天、草稿、已确认记忆和企鹅成长。",
  },
  {
    id: "personal",
    label: "个人",
    description: "企鹅长期记忆与成长；不包含聊天记录、API地址或访问口令。",
  },
];
export const scopeLabel = (scope) =>
  backupScopes.find((x) => x.id === scope)?.label || "全部数据";
export const scopeHasPhotos = (scope) =>
  ["all", "nutrition", "travel", "chat"].includes(scope);
const sections = {
  bills: ["budgets"],
  nutrition: ["nutrition", "personalFoods", "nutritionExpenseLinksOmitted"],
  fridge: ["fridge"],
  travel: ["travel", "overseas"],
  chat: ["chat"],
  personal: ["chat"],
};
export function validateScopedBackup(data) {
  if (data?.exportScope === undefined) return;
  const scope = data.exportScope;
  if (!backupScopes.some((x) => x.id === scope)) throw Error("备份范围无效");
  if (scope === "all") return;
  const allowed = new Set([
    "version",
    "expenses",
    "exportScope",
    ...sections[scope],
  ]);
  if (sections[scope].some((key) => !Object.hasOwn(data, key)))
    throw Error("单模块备份缺少对应数据");
  if (Object.keys(data).some((key) => !allowed.has(key)))
    throw Error("单模块备份包含范围外的数据");
  if (
    scope !== "bills" &&
    (!Array.isArray(data.expenses) || data.expenses.length)
  )
    throw Error("这个模块的备份不应包含账单");
  if (
    scope === "nutrition" &&
    (data.nutritionExpenseLinksOmitted !== true ||
      !data.nutrition ||
      !Array.isArray(data.nutrition.meals) ||
      data.nutrition.meals.some((x) => x.expenseId !== null))
  )
    throw Error("营养屋独立备份的账单关联格式无效");
  if (
    scope === "personal" &&
    (!data.chat ||
      !Array.isArray(data.chat.threads) ||
      data.chat.threads.length ||
      !Array.isArray(data.chat.messages) ||
      data.chat.messages.length ||
      data.chat.drafts !== undefined)
  )
    throw Error("个人备份不应包含聊天记录或草稿");
}
export function buildScopedBackup(
  snapshot,
  scope = "all",
  includePhotos = true,
) {
  if (!backupScopes.some((x) => x.id === scope))
    throw Error("请选择有效导出范围");
  const has = (section) => scope === "all" || scope === section;
  const out = {
    version: 1,
    exportScope: scope,
    expenses: has("bills") ? snapshot.expenses : [],
  };
  if (has("bills")) out.budgets = snapshot.budgets;
  if (has("nutrition")) {
    out.personalFoods = snapshot.personalFoods;
    out.nutrition = {
      meals: snapshot.meals.map((meal) => ({
        ...meal,
        ...(scope === "nutrition" ? { expenseId: null } : {}),
        ...(!includePhotos ? { photo: null } : {}),
      })),
      profile: snapshot.profile,
      photosIncluded: includePhotos,
    };
    if (scope === "nutrition") out.nutritionExpenseLinksOmitted = true;
  }
  if (has("fridge"))
    out.fridge = {
      inventory: snapshot.inventory,
      shopping: snapshot.shopping,
      preferences: snapshot.preferences,
    };
  if (has("travel")) {
    const trips = (rows) =>
      rows.map((trip) => (includePhotos ? trip : { ...trip, photos: [] }));
    out.travel = {
      trips: trips(snapshot.trips),
      visitedCities: snapshot.visitedCities,
      spots: snapshot.spots,
      photosIncluded: includePhotos,
    };
    out.overseas = {
      trips: trips(snapshot.overseasTrips),
      photosIncluded: includePhotos,
    };
  }
  if (has("chat") || scope === "personal") {
    out.chat = {
      threads: scope === "personal" ? [] : snapshot.threads,
      messages:
        scope === "personal"
          ? []
          : snapshot.messages.map((message) =>
              includePhotos ? message : { ...message, photo: undefined },
            ),
      memories: snapshot.memories,
      growth: snapshot.growth,
    };
    if (scope !== "personal") {
      out.chat.drafts = snapshot.drafts;
      out.chat.photosIncluded = includePhotos;
    }
  }
  validateScopedBackup(out);
  return out;
}

export function selectTravelSnapshot(snapshot, selection) {
  if (
    !selection ||
    !["domestic", "overseas"].includes(selection.kind) ||
    typeof selection.id !== "string" ||
    !selection.id
  )
    throw Error("请选择有效的旅行日记");
  const list =
    selection.kind === "domestic" ? snapshot.trips : snapshot.overseasTrips;
  const trip = (list || []).find((row) => row.id === selection.id);
  if (!trip) throw Error("这篇旅行日记已不存在，请重新选择");
  return {
    ...snapshot,
    trips: selection.kind === "domestic" ? [trip] : [],
    overseasTrips: selection.kind === "overseas" ? [trip] : [],
    visitedCities: [],
    spots: [],
  };
}
export function travelExportName(title) {
  return (
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .trim()
      .slice(0, 60) || "未命名旅行"
  );
}
