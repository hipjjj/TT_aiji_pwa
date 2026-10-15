import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePersonalFood,
  checkPersonalFoodNames,
  validatePersonalFoodBackup,
  personalFoodDefinition,
  preparePersonalFoodUpdates,
} from "../src/nutrition/personal-foods.mjs";
import {
  parseMealText,
  findFood,
  searchFoods,
  validateMeal,
  validateNutritionBackup,
} from "../src/nutrition/model.mjs";
const sample = (extra = {}) => ({
  id: "personal-food-one",
  name: "少油炒牛肉",
  aliases: ["我的牛肉"],
  per100: { kcal: 180, protein: 25, carbs: 2, fat: 8 },
  defaultGrams: 150,
  gramsPerFist: 130,
  note: "少油，不加糖，每100克参考估算",
  updatedAt: 1,
  ...extra,
});
test("personal foods validate bounded nutrition, aliases, fist and default weight", () => {
  const own = validatePersonalFood(sample());
  assert.equal(own.key, "少油炒牛肉");
  assert.equal(
    validatePersonalFood(sample({ gramsPerFist: null })).gramsPerFist,
    null,
  );
  for (const change of [
    { name: "()" },
    { id: "rice" },
    { gramsPerFist: 0 },
    { defaultGrams: NaN },
    { note: "a".repeat(501) },
    { aliases: ["()"] },
    { per100: { kcal: 900, protein: 100, carbs: 100, fat: 100 } },
  ])
    assert.throws(() => validatePersonalFood(sample(change)));
  const duplicate = validatePersonalFood(
    sample({
      id: "personal-food-two",
      name: "另一道菜",
      aliases: ["我的牛肉"],
    }),
  );
  assert.throws(() => checkPersonalFoodNames([own, duplicate]));
});
test("user confirmed foods and aliases take local priority without altering built-in defaults", () => {
  const own = personalFoodDefinition(
    validatePersonalFood(
      sample({ name: "米饭（熟）", aliases: ["米饭", "我的饭"] }),
    ),
  );
  assert.equal(findFood("米饭", [own]).id, own.id);
  assert.notEqual(findFood("米饭").id, own.id);
  assert.equal(searchFoods("我的饭", "我的食物", [own])[0].id, own.id);
  const result = parseMealText("我的饭两拳+米饭100g", [own]);
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(
    result.items.map((x) => x.grams),
    [260, 100],
  );
  assert.equal(result.items[0].per100.kcal, 180);
  assert.match(result.items[0].assumption, /我的食物库/);
  const noFist = personalFoodDefinition(
    validatePersonalFood(sample({ gramsPerFist: null })),
  );
  assert.equal(parseMealText("我的牛肉两拳", [noFist]).items.length, 0);
});
test("confirmed same-name updates reuse identity and cannot collide with other aliases", () => {
  const old = validatePersonalFood(sample());
  const updated = preparePersonalFoodUpdates(
    [old],
    [
      sample({
        id: "personal-food-new",
        per100: { kcal: 160, protein: 25, carbs: 2, fat: 6 },
      }),
    ],
  );
  assert.equal(updated[0].id, old.id);
  assert.equal(updated[0].per100.kcal, 160);
  assert.throws(() =>
    preparePersonalFoodUpdates(
      [old],
      [
        sample({
          id: "personal-food-new",
          name: "另一道菜",
          aliases: ["我的牛肉"],
        }),
      ],
    ),
  );
});
test("personal-food backups preserve optional fist, reject duplicate aliases, and never require old backups to include the library", () => {
  assert.equal(validatePersonalFoodBackup({ version: 1, expenses: [] }), null);
  assert.deepEqual(validatePersonalFoodBackup({ personalFoods: [] }), []);
  const records = validatePersonalFoodBackup({ personalFoods: [sample()] });
  assert.equal(records[0].gramsPerFist, 130);
  assert.throws(() =>
    validatePersonalFoodBackup({
      personalFoods: [sample(), sample({ id: "personal-food-other" })],
    }),
  );
  const items = parseMealText(
    "我的牛肉半拳",
    records.map(personalFoodDefinition),
  ).items;
  const meal = validateMeal({
    id: "snapshot",
    date: "2026-10-15",
    mealType: "午餐",
    items,
    note: "",
    photo: null,
    expenseId: null,
    updatedAt: 1,
  });
  const restored = validateNutritionBackup({
    nutrition: { meals: [meal], profile: null },
  });
  assert.deepEqual(restored.meals[0].items, meal.items);
  const updated = personalFoodDefinition(
    validatePersonalFood(
      sample({ per100: { kcal: 100, protein: 10, carbs: 2, fat: 5 } }),
    ),
  );
  assert.equal(
    parseMealText("我的牛肉半拳", [updated]).items[0].per100.kcal,
    100,
  );
  assert.equal(meal.items[0].per100.kcal, 180);
});
