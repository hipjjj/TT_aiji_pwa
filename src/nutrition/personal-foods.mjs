import { validateNutrients } from "./model.mjs";
export const personalFoodKey = (name) =>
  name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s()]/g, "");
/** @returns {import('./types').PersonalFood} */
export function validatePersonalFood(x) {
  if (
    !x ||
    typeof x.id !== "string" ||
    !x.id.startsWith("personal-food-") ||
    x.id.length > 100 ||
    typeof x.name !== "string" ||
    !x.name.trim() ||
    x.name.length > 100 ||
    typeof x.note !== "string" ||
    x.note.length > 500 ||
    !Array.isArray(x.aliases) ||
    x.aliases.length > 10 ||
    !Number.isSafeInteger(x.updatedAt) ||
    x.updatedAt < 0
  )
    throw Error("我的食物库条目格式无效");
  const key = personalFoodKey(x.name),
    aliases = [];
  if (!key) throw Error("请填写有效食物名称");
  for (const alias of x.aliases) {
    if (
      typeof alias !== "string" ||
      !alias.trim() ||
      alias.length > 100 ||
      !personalFoodKey(alias)
    )
      throw Error("别名须为1至100个字");
    if (
      personalFoodKey(alias) !== key &&
      !aliases.some((a) => personalFoodKey(a) === personalFoodKey(alias))
    )
      aliases.push(alias.trim());
  }
  if (
    !Number.isFinite(x.defaultGrams) ||
    x.defaultGrams < 0.01 ||
    x.defaultGrams > 10000
  )
    throw Error("默认份量须为0.01至10000克");
  if (
    x.gramsPerFist !== null &&
    (!Number.isFinite(x.gramsPerFist) ||
      x.gramsPerFist < 0.01 ||
      x.gramsPerFist > 10000)
  )
    throw Error("每拳重量须为0.01至10000克，或留空");
  return {
    id: x.id,
    key,
    name: x.name.trim(),
    aliases,
    per100: validateNutrients(x.per100),
    defaultGrams: x.defaultGrams,
    gramsPerFist: x.gramsPerFist,
    note: x.note.trim(),
    updatedAt: x.updatedAt,
  };
}
export function checkPersonalFoodNames(records) {
  if (records.length > 10000) throw Error("我的食物库最多保存10000项");
  const names = new Map(),
    ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) throw Error("我的食物库编号重复");
    ids.add(record.id);
    for (const name of [record.name, ...record.aliases]) {
      const key = personalFoodKey(name);
      if (names.has(key) && names.get(key) !== record.id)
        throw Error(`食物名称或别名“${name}”已存在，请改名区分做法`);
      names.set(key, record.id);
    }
  }
  return records;
}
export function validatePersonalFoodBackup(data) {
  if (data.personalFoods === undefined) return null;
  if (!Array.isArray(data.personalFoods) || data.personalFoods.length > 10000)
    throw Error("我的食物库备份格式无效");
  return checkPersonalFoodNames(data.personalFoods.map(validatePersonalFood));
}
/** @returns {import('./types').FoodDefinition} */
export function personalFoodDefinition(record) {
  const x = validatePersonalFood(record);
  return {
    ...x,
    group: "我的食物",
    portions: {
      份: x.defaultGrams,
      ...(x.gramsPerFist ? { 拳: x.gramsPerFist } : {}),
    },
    defaultUnit: "份",
    reference: "我的食物库 · 你已确认的参考值",
    sourceId: x.id,
    sourceName: x.name,
    note: x.note,
    kind: "ingredient",
    estimated: true,
  };
}
export function preparePersonalFoodUpdates(existing, incoming) {
  const prepared = incoming.map((row) => {
    const x = validatePersonalFood(row),
      same = existing.find((r) => r.key === x.key);
    return same ? { ...x, id: same.id } : x;
  });
  const updated = new Map(existing.map((x) => [x.id, x]));
  for (const x of prepared) updated.set(x.id, x);
  checkPersonalFoodNames([...updated.values()]);
  checkPersonalFoodNames(prepared);
  return prepared;
}
