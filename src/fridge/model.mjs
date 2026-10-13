import {recordLimits} from '../recordLimits.mjs';
import { validDate } from "../model.mjs";
import {
  foodLibrary,
  localDate,
  round,
  validateNutrients,
} from "../nutrition/model.mjs";
import { recipeLibrary } from "./recipes.mjs";
export { recipeLibrary };
export const locations = ["冷藏", "冷冻", "常温"];
export const pantryOptions = [
  "食用油",
  "盐",
  "酱油",
  "糖",
  "醋",
  "水",
  "蒜",
  "生姜",
];
export const defaultPreferences = {
  id: "main",
  servings: 2,
  maxMinutes: 45,
  allergies: "",
  avoid: "",
  preference: "不限",
  showNutrition: false,
  pantry: ["食用油", "盐", "酱油", "水"],
};
const aliases = {
  番茄: ["西红柿", "番茄（生）"],
  鸡蛋: ["蛋", "鸡蛋（生、去壳）"],
  熟鸡蛋: ["水煮鸡蛋", "鸡蛋（水煮、去壳）"],
  鸡胸肉: ["鸡胸", "鸡胸肉（生、去皮）"],
  熟鸡胸肉: ["鸡胸肉（熟、去皮）"],
  猪里脊: ["猪肉", "里脊", "猪里脊（生、瘦肉）"],
  青椒: ["青椒（生）"],
  黄瓜: ["黄瓜（生、带皮）"],
  西兰花: ["花椰菜", "西兰花（生）"],
  菠菜: ["菠菜（生）"],
  小白菜: ["青菜", "小白菜（水煮）"],
  大米: ["生米", "大米（干）"],
  熟米饭: ["米饭", "米饭（熟）", "剩饭"],
  熟面条: ["面条（煮熟参考）", "煮熟面条"],
  面条: ["挂面", "干面条"],
  燕麦片: ["燕麦", "燕麦片（干）"],
  小米: ["小米（干）"],
  牛奶: ["全脂牛奶"],
  北豆腐: ["豆腐", "老豆腐", "北豆腐（未加油）"],
  嫩豆腐: ["软豆腐", "嫩豆腐（未加油）"],
  熟虾仁: ["虾仁（水煮）", "水煮虾仁"],
  虾仁: ["生虾仁", "虾"],
  蘑菇: ["白蘑菇", "白蘑菇（水煮）"],
  吐司: ["白吐司", "面包"],
  食用油: ["油", "大豆油", "食用油（大豆油参考）"],
  酱油: ["生抽", "酱油（参考）"],
  糖: ["白糖", "白砂糖"],
  水: ["饮用水"],
  生姜: ["姜", "生姜（生）"],
  三文鱼: ["三文鱼（生）"],
};
export const normalizeName = (name) =>
  String(name).trim().replace(/\s/g, "").toLowerCase();
export function ingredientKey(name) {
  const n = normalizeName(name);
  return (
    Object.keys(aliases).find((key) =>
      [key, ...aliases[key]].some((alias) => normalizeName(alias) === n),
    ) || n
  );
}
function text(value, max, label, empty = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    throw new Error(`${label}无效`);
  return value.trim();
}
function numeric(value, min, max, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label}无效`);
  return value;
}
function id(value) {
  return text(value, 100, "编号", false);
}
export function validateInventoryItem(value) {
  if (!value || !locations.includes(value.location))
    throw new Error("请选择存放位置");
  if (value.expiry !== null && !validDate(value.expiry))
    throw new Error("到期日期无效");
  return {
    id: id(value.id),
    name: text(value.name, recordLimits.name, "食材名称", false),
    quantity: text(value.quantity, recordLimits.quantity, "食材数量"),
    unit: text(value.unit, recordLimits.unit, "单位"),
    location: value.location,
    expiry: value.expiry,
    note: text(value.note, recordLimits.note, "备注"),
    updatedAt: numeric(value.updatedAt, 0, Number.MAX_SAFE_INTEGER, "更新时间"),
  };
}
export function validateShoppingItem(value) {
  if (
    !value ||
    typeof value.checked !== "boolean" ||
    typeof value.stocked !== "boolean" ||
    (value.stocked && !value.checked)
  )
    throw new Error("购物清单状态无效");
  return {
    id: id(value.id),
    name: text(value.name, recordLimits.name, "购物食材", false),
    quantity: text(value.quantity, recordLimits.quantity, "购物数量"),
    unit: text(value.unit, recordLimits.unit, "单位"),
    note: text(value.note, recordLimits.note, "购物备注"),
    recipeName: text(value.recipeName, 100, "菜名"),
    checked: value.checked,
    stocked: value.stocked,
    updatedAt: numeric(value.updatedAt, 0, Number.MAX_SAFE_INTEGER, "更新时间"),
  };
}
export function validatePreferences(value) {
  if (
    !value ||
    value.id !== "main" ||
    !Number.isInteger(value.servings) ||
    !["不限", "减脂", "高蛋白"].includes(value.preference) ||
    typeof value.showNutrition !== "boolean" ||
    !Array.isArray(value.pantry) ||
    value.pantry.length > 30
  )
    throw new Error("冰箱偏好设置无效");
  return {
    id: "main",
    servings: numeric(value.servings, 1, 8, "用餐人数"),
    maxMinutes: numeric(value.maxMinutes, 5, 180, "做饭时间"),
    allergies: text(value.allergies, 200, "过敏设置"),
    avoid: text(value.avoid, 200, "忌口设置"),
    preference: value.preference,
    showNutrition: value.showNutrition,
    pantry: [
      ...new Set(value.pantry.map((name) => text(name, 60, "常备调料", false))),
    ],
  };
}
export function validateFridgeBackup(value) {
  if (!Object.hasOwn(value, "fridge")) return null;
  const data = value.fridge;
  if (
    !data ||
    !Array.isArray(data.inventory) ||
    !Array.isArray(data.shopping) ||
    data.inventory.length > 10000 ||
    data.shopping.length > 10000
  )
    throw new Error("冰箱备份格式无效");
  const inventory = data.inventory.map(validateInventoryItem),
    shopping = data.shopping.map(validateShoppingItem);
  for (const records of [inventory, shopping])
    if (new Set(records.map((item) => item.id)).size !== records.length)
      throw new Error("冰箱备份存在重复编号");
  return {
    inventory,
    shopping,
    preferences:
      data.preferences === null ? null : validatePreferences(data.preferences),
  };
}
export function expiryStatus(item, today = localDate()) {
  if (!item.expiry) return "日期未填";
  if (item.expiry < today) return "已到期";
  const days = Math.round(
    (Date.parse(item.expiry + "T00:00:00Z") -
      Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
  return days === 0 ? "今天到期" : days <= 3 ? "快到期" : "保鲜中";
}
export function sortedInventory(items) {
  return [...items].sort(
    (a, b) =>
      (a.expiry || "9999").localeCompare(b.expiry || "9999") ||
      b.updatedAt - a.updatedAt,
  );
}
const units = { g: "克", kg: "千克", 公斤: "千克", ml: "毫升", l: "升" };
export function parseQuantity(quantity, unit = "") {
  const replaced = String(quantity)
    .trim()
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  const m = replaced.match(
    /^(\d+(?:\.\d+)?|半|一|二|两|三|四|五|六|七|八|九|十)\s*([^\d\s]*)$/,
  );
  if (!m) return null;
  const digits = {
    半: 0.5,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const amount = digits[m[1]] ?? Number(m[1]);
  const rawUnit = m[2] || unit;
  return { amount, unit: units[rawUnit.toLowerCase()] || rawUnit };
}
export function convertAmount(amount, from, to) {
  if (from === to && from) return amount;
  const weights = { 克: 1, 千克: 1000, 斤: 500, 两: 50 },
    volume = { 毫升: 1, 升: 1000 };
  if (weights[from] && weights[to])
    return (amount * weights[from]) / weights[to];
  if (volume[from] && volume[to]) return (amount * volume[from]) / volume[to];
  return null;
}
export function stockMatch(
  ingredient,
  inventory,
  pantry = [],
  today = localDate(),
) {
  const key = ingredientKey(ingredient.name),
    matches = inventory.filter((item) => ingredientKey(item.name) === key);
  const usable = matches.filter(
    (item) => expiryStatus(item, today) !== "已到期",
  );
  if (ingredient.pantry && pantry.some((name) => ingredientKey(name) === key))
    return {
      status: "pantry",
      available: ingredient.amount,
      missing: 0,
      matches: [],
      note: "常备调料",
    };
  let amount = 0,
    uncertain = false;
  for (const item of usable) {
    const q = parseQuantity(item.quantity, item.unit);
    const converted = q
      ? convertAmount(q.amount, q.unit, ingredient.unit)
      : null;
    if (converted === null) uncertain = true;
    else amount += converted;
  }
  if (amount >= ingredient.amount)
    return {
      status: "enough",
      available: round(amount, 2),
      missing: 0,
      matches: usable,
      note: "库存够用",
    };
  if (uncertain)
    return {
      status: "check",
      available: round(amount, 2),
      missing: null,
      matches: usable,
      note: "有库存，数量或单位需要核对",
    };
  return {
    status: "missing",
    available: round(amount, 2),
    missing: round(ingredient.amount - amount, 2),
    matches: usable,
    note:
      matches.length && !usable.length ? "库存已到期，不计入推荐" : "需要补充",
  };
}
export function scaleRecipe(recipe, servings) {
  const ratio = servings / recipe.servings;
  return {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      amount: round(item.amount * ratio, 2),
    })),
  };
}
const allergenGroups = {
  蛋: ["鸡蛋", "熟鸡蛋"],
  奶: ["牛奶", "酸奶", "奶酪"],
  乳: ["牛奶", "酸奶", "奶酪"],
  大豆: ["北豆腐", "嫩豆腐", "酱油", "豆浆"],
  豆: ["北豆腐", "嫩豆腐", "酱油", "豆浆"],
  小麦: ["吐司", "面条", "熟面条", "面粉", "酱油"],
  麸质: ["吐司", "面条", "熟面条", "面粉", "酱油"],
  海鲜: ["三文鱼", "虾仁", "熟虾仁", "鱼", "虾", "蟹"],
  鱼: ["三文鱼", "鳕鱼", "罗非鱼"],
  坚果: ["花生", "核桃", "巴旦木", "腰果"],
  花生: ["花生", "花生酱"],
};
export function blockedIngredients(recipe, prefs) {
  const tokens = `${prefs.allergies},${prefs.avoid}`
    .split(/[，,、；;\n\s]+/)
    .map(normalizeName)
    .filter(Boolean);
  return recipe.ingredients
    .filter((item) =>
      tokens.some((token) => {
        const key = ingredientKey(item.name),
          group = allergenGroups[token.replace(/过敏$/, "")];
        return group
          ? group.some((name) => key.includes(ingredientKey(name)))
          : key.includes(ingredientKey(token)) ||
              normalizeName(item.name).includes(token);
      }),
    )
    .map((item) => item.name);
}
export function formatQuantity(quantity, unit = "") {
  return quantity
    ? unit && !quantity.trim().endsWith(unit)
      ? `${quantity}${unit}`
      : quantity
    : "数量待补充";
}
function ingredientGrams(item) {
  return (
    convertAmount(item.amount, item.unit, "克") ??
    (item.gramsPerUnit ? item.amount * item.gramsPerUnit : null)
  );
}
export function recipeNutrition(recipe) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const missing = [];
  for (const item of recipe.ingredients) {
    if (ingredientKey(item.name) === "盐") continue;
    const food = foodLibrary.find((food) => food.id === item.foodId);
    const grams = ingredientGrams(item);
    const nutrients = food?.per100 || item.per100;
    if (!nutrients || grams === null) {
      missing.push(item.name);
      continue;
    }
    for (const key of Object.keys(totals))
      totals[key] += (nutrients[key] * grams) / 100;
  }
  return {
    perServing: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [
        key,
        round(value / recipe.servings),
      ]),
    ),
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, round(value)]),
    ),
    complete: missing.length === 0,
    missing,
  };
}
export function assessRecipe(recipe, inventory, prefs, today = localDate()) {
  const scaled = scaleRecipe(recipe, prefs.servings),
    matches = scaled.ingredients.map((item) => ({
      ...item,
      stock: stockMatch(item, inventory, prefs.pantry, today),
    }));
  const required = matches.filter((item) => !item.optional),
    missing = required.filter((item) => item.stock.status === "missing"),
    checks = required.filter((item) => item.stock.status === "check");
  const urgent = matches
    .filter((item) =>
      item.stock.matches.some((stock) =>
        ["今天到期", "快到期"].includes(expiryStatus(stock, today)),
      ),
    )
    .map((item) => item.name);
  return {
    recipe: scaled,
    matches,
    missing,
    checks,
    urgent,
    blocked: blockedIngredients(recipe, prefs),
    nutrition: recipeNutrition(scaled),
    status: missing.length
      ? "补几样就能做"
      : checks.length
        ? "份量待核对"
        : "现在就能做",
  };
}
export function recommendRecipes(
  inventory,
  prefs,
  query = "",
  today = localDate(),
) {
  return recipeLibrary
    .filter(
      (recipe) =>
        (!query || normalizeName(recipe.name).includes(normalizeName(query))) &&
        recipe.minutes <= prefs.maxMinutes &&
        !blockedIngredients(recipe, prefs).length &&
        (prefs.preference === "不限" || recipe.tags.includes(prefs.preference)),
    )
    .map((recipe) => assessRecipe(recipe, inventory, prefs, today))
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        a.checks.length - b.checks.length ||
        b.urgent.length - a.urgent.length ||
        a.recipe.minutes - b.recipe.minutes,
    );
}
export function shoppingFromAssessment(assessment) {
  return assessment.matches
    .filter(
      (item) =>
        !item.optional && ["missing", "check"].includes(item.stock.status),
    )
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: item.stock.status === "check" ? "" : String(item.stock.missing),
      unit: item.stock.status === "check" ? "" : item.unit,
      note:
        item.stock.status === "check"
          ? `库存数量待核对；这道菜需要${item.amount}${item.unit}`
          : "",
      recipeName: assessment.recipe.name,
      checked: false,
      stocked: false,
      updatedAt: Date.now(),
    }));
}
export function validateAIRecipeResult(value) {
  if (!value || !Array.isArray(value.recipes) || value.recipes.length > 5)
    throw new Error("AI食谱格式无效");
  const recipes = value.recipes.map((recipe, index) => {
    if (
      !recipe ||
      !Array.isArray(recipe.ingredients) ||
      !recipe.ingredients.length ||
      recipe.ingredients.length > 25 ||
      !Array.isArray(recipe.steps) ||
      !recipe.steps.length ||
      recipe.steps.length > 15 ||
      !Number.isInteger(recipe.servings)
    )
      throw new Error("AI食谱内容无效");
    const ingredients = recipe.ingredients.map((item) => {
      const name = text(item.name, recordLimits.name, "AI食材名称", false),
        suppliedUnit = text(item.unit, recordLimits.unit, "AI食材单位", false),
        unit = units[suppliedUnit.toLowerCase()] || suppliedUnit;
      const matched = foodLibrary.find(
        (food) =>
          food.kind === "ingredient" &&
          ingredientKey(food.name) === ingredientKey(name),
      );
      const gramsPerUnit =
        item.gramsPerUnit === null || item.gramsPerUnit === undefined
          ? null
          : numeric(item.gramsPerUnit, 0.01, 10000, "单位重量");
      const per100 =
        item.per100 === null || item.per100 === undefined
          ? null
          : validateNutrients(item.per100);
      const ingredient = {
        name,
        amount: numeric(item.amount, 0.01, 10000, "AI食材用量"),
        unit,
        ...(matched ? { foodId: matched.id } : per100 ? { per100 } : {}),
        ...(gramsPerUnit ? { gramsPerUnit } : {}),
        pantry: pantryOptions.some(
          (p) => ingredientKey(p) === ingredientKey(name),
        ),
        optional: false,
      };
      const weight = ingredientGrams(ingredient);
      if (weight !== null && weight > 10000)
        throw new Error("AI食材总重量过大，请重新确认");
      return ingredient;
    });
    if (
      new Set(ingredients.map((item) => ingredientKey(item.name))).size !==
      ingredients.length
    )
      throw new Error("AI食材清单重复，请重新分析");
    return {
      id: `ai-${index}-${normalizeName(recipe.name)}`,
      name: text(recipe.name, 60, "AI菜名", false),
      emoji: "🍽️",
      servings: numeric(recipe.servings, 1, 8, "AI人数"),
      minutes: numeric(recipe.minutes, 1, 180, "AI做饭时间"),
      ingredients,
      steps: recipe.steps.map((step) => text(step, 400, "AI步骤", false)),
      tags: [],
      source: "ai",
      note: text(recipe.note, 500, "AI食谱说明"),
    };
  });
  return { recipes, note: text(value.note, 500, "AI说明") };
}
export function validateRecipeRequest(value) {
  if (
    !value ||
    !["inventory", "dish"].includes(value.mode) ||
    !Array.isArray(value.inventory) ||
    value.inventory.length > 100
  )
    throw new Error("食谱请求格式无效");
  const preferences = validatePreferences(value.preferences);
  const dish = text(value.dish, 100, "想吃的菜");
  if (value.mode === "dish" && !dish) throw new Error("请填写想吃的菜");
  const inventory = value.inventory.map((item) => ({
    name: text(item.name, recordLimits.name, "食材", false),
    quantity: text(item.quantity, 40, "数量"),
    unit: text(item.unit, recordLimits.unit, "单位"),
  }));
  return { mode: value.mode, dish, inventory, preferences };
}
export function recipeMealPortions(recipe, servingsEaten) {
  if (!recipeNutrition(recipe).complete)
    throw new Error("这道菜有未匹配营养数据的食材，请到营养屋核对后记录");
  const total = recipeNutrition(recipe).totals,
    grams = recipe.ingredients.reduce(
      (sum, item) => sum + (ingredientGrams(item) || 0),
      0,
    );
  if (!grams) throw new Error("食谱重量无法估算");
  return [
    {
      id: crypto.randomUUID(),
      name: recipe.name,
      grams: round((grams / recipe.servings) * servingsEaten, 2),
      per100: validateNutrients(
        Object.fromEntries(
          Object.entries(total).map(([key, value]) => [
            key,
            round((value / grams) * 100, 2),
          ]),
        ),
      ),
      source: recipe.source === "ai" ? "ai" : "dictionary",
      sourceLabel:
        recipe.source === "ai"
          ? "嘟嘟糕AI食谱 · 食物库估算"
          : "嘟嘟糕食谱库 · 食材营养估算",
      assumption:
        "按食材配方估算，记录的是个人食用份数；烹饪失水、油量和实际份量请核对。",
    },
  ];
}
