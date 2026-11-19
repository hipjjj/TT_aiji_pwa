import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessRecipe,
  assessRecipeOptions,
  blockedIngredients,
  convertAmount,
  defaultPreferences,
  expiryStatus,
  ingredientKey,
  parseQuantity,
  recipeMealPortions,
  recipeNutrition,
  shoppingFromAssessment,
  stockMatch,
  validateAIRecipeResult,
  validateFridgeBackup,
  validateInventoryItem,
  validatePreferences,
  validateRecipeRequest,
} from "../src/fridge/model.mjs";
import { sumNutrition } from "../src/nutrition/model.mjs";
const recipeExamples = JSON.parse(readFileSync(new URL("./fixtures/recipe-assessment.json", import.meta.url)));
const today = "2026-10-12";
const stock = (name, quantity = "", unit = "", expiry = null) => ({
  id: crypto.randomUUID(),
  name,
  quantity,
  unit,
  expiry,
  location: "冷藏",
  note: "",
  updatedAt: 1,
});
const prefs = { ...defaultPreferences, pantry: [...defaultPreferences.pantry] };
test("inventory backup rejects invalid expiry, duplicate IDs and corrupt quantities before merging; legacy absence preserves fridge", () => {
  const item = stock("西红柿", "半袋");
  assert.equal(validateInventoryItem(item).quantity, "半袋");
  assert.throws(() => validateInventoryItem({ ...item, expiry: "2026-02-30" }));
  assert.equal(validateFridgeBackup({ version: 1 }), null);
  const backup = {
    fridge: { inventory: [item], shopping: [], preferences: prefs },
  };
  assert.equal(validateFridgeBackup(backup).inventory.length, 1);
  assert.throws(() =>
    validateFridgeBackup({
      fridge: { ...backup.fridge, inventory: [item, item] },
    }),
  );
  assert.throws(() =>
    validateFridgeBackup({
      fridge: { ...backup.fridge, preferences: { ...prefs, servings: 0 } },
    }),
  );
});
test("simple quantities preserve uncertainty and do not confuse raw rice or meat with cooked food", () => {
  assert.equal(ingredientKey("西红柿"), ingredientKey("番茄"));
  assert.notEqual(ingredientKey("大米"), ingredientKey("熟米饭"));
  assert.notEqual(ingredientKey("鸡胸肉"), ingredientKey("鸡胸肉（熟、去皮）"));
  assert.deepEqual(parseQuantity("半袋"), { amount: 0.5, unit: "袋" });
  assert.equal(convertAmount(0.5, "千克", "克"), 500);
  assert.equal(convertAmount(2, "个", "克"), null);
  const item = { name: "番茄", amount: 2, unit: "个" };
  assert.equal(
    stockMatch(item, [stock("西红柿", "半袋")], [], today).status,
    "check",
  );
  assert.equal(
    stockMatch(item, [stock("番茄", "2", "个")], [], today).status,
    "enough",
  );
  assert.equal(
    stockMatch(item, [stock("番茄", "1", "个")], [], today).missing,
    1,
  );
});
test("expired inventory is excluded, soon expiring ingredients affect ranking and pantry can be removed", () => {
  assert.equal(
    expiryStatus(stock("鸡蛋", "3", "个", "2026-10-11"), today),
    "已到期",
  );
  assert.equal(
    expiryStatus(stock("鸡蛋", "3", "个", today), today),
    "今天到期",
  );
  assert.equal(
    stockMatch(
      { name: "鸡蛋", amount: 3, unit: "个" },
      [stock("鸡蛋", "3", "个", "2026-10-11")],
      [],
      today,
    ).status,
    "missing",
  );
  const tomato = recipeExamples.find((r) => r.id === "tomato-eggs");
  const inventory = [
    stock("西红柿", "2", "个", "2026-10-13"),
    stock("鸡蛋", "3", "个"),
  ];
  const assessment = assessRecipe(tomato, inventory, prefs, today);
  assert.equal(assessment.status, "现在就能做");
  assert.deepEqual(assessment.urgent, ["番茄"]);
  assert.equal(
    assessRecipe(tomato, inventory, { ...prefs, pantry: [] }, today).missing
      .length,
    2,
  );
});
test("recipe quantities scale with diners and shopping lists buy shortfalls, flag unknown quantities and preserve source", () => {
  const recipe = recipeExamples.find((r) => r.id === "tomato-eggs");
  const assessment = assessRecipe(
    recipe,
    [stock("番茄", "1", "个"), stock("鸡蛋", "一些")],
    { ...prefs, servings: 4 },
    today,
  );
  assert.equal(
    assessment.recipe.ingredients.find((i) => i.name === "番茄").amount,
    4,
  );
  const shopping = shoppingFromAssessment(assessment);
  assert.equal(shopping.find((i) => i.name === "番茄").quantity, "3");
  const eggs = shopping.find((i) => i.name === "鸡蛋");
  assert.equal(eggs.quantity, "");
  assert.match(eggs.note, /需要6个/);
  assert.equal(eggs.recipeName, "番茄炒蛋");
});
test("recipe suggestions contain only supplied options and respect allergies, avoidance and cooking time", () => {
  assert.deepEqual(assessRecipeOptions([], [], prefs, today), []);
  const noEgg = assessRecipeOptions(recipeExamples, [], { ...prefs, allergies: "蛋" }, today);
  assert(noEgg.length > 0 && noEgg.length < recipeExamples.length);
  assert(!noEgg.some(r => r.recipe.ingredients.some(i => i.name === "鸡蛋")));
  const noSoy = assessRecipeOptions(recipeExamples, [], { ...prefs, allergies: "大豆" }, today);
  assert(noSoy.length > 0 && noSoy.length < recipeExamples.length);
  assert(!noSoy.some(r => r.recipe.ingredients.some(i => ["北豆腐", "嫩豆腐", "酱油"].includes(i.name))));
  const quick = assessRecipeOptions(recipeExamples, [], { ...prefs, maxMinutes: 10 }, today);
  assert.deepEqual(quick.map(r => r.recipe.id), ["banana-milk"]);
  assert.equal(blockedIngredients(recipeExamples.find(r => r.id === "tomato-eggs"), { ...prefs, avoid: "西红柿" }).length, 1);
});
test("recipe meal records still count personal portions rather than the full pan", () => {
  for (const recipe of recipeExamples) {
    const nutrition = recipeNutrition(recipe);
    assert(nutrition.complete, recipe.name);
    assert(nutrition.totals.kcal > 0);
    const saved = sumNutrition(recipeMealPortions(recipe, 1));
    assert(Math.abs(saved.kcal - nutrition.perServing.kcal) < 0.3, recipe.name);
  }
});
test("AI recipe response is bounded, unknown nutrients remain incomplete and request strips unrelated private data", () => {
  const recipe = {
    name: "测试菜",
    servings: 2,
    minutes: 15,
    ingredients: [
      {
        name: "未知蔬菜",
        amount: 200,
        unit: "克",
        gramsPerUnit: 1,
        per100: null,
      },
    ],
    steps: ["蒸熟"],
    note: "估算",
  };
  const result = validateAIRecipeResult({
    recipes: [recipe],
    note: "核对份量",
  });
  assert.equal(recipeNutrition(result.recipes[0]).complete, false);
  assert.throws(() =>
    validateAIRecipeResult({
      recipes: [
        { ...recipe, ingredients: [{ ...recipe.ingredients[0], amount: -1 }] },
      ],
      note: "",
    }),
  );
  const request = validateRecipeRequest({
    mode: "dish",
    dish: "测试菜",
    preferences: prefs,
    inventory: [
      {
        name: "青菜",
        quantity: "半袋",
        unit: "",
        photo: "private",
        note: "private",
      },
    ],
    profile: "private",
  });
  assert.deepEqual(request.inventory, [
    { name: "青菜", quantity: "半袋", unit: "" },
  ]);
  assert(!JSON.stringify(request).includes("private"));
  assert.throws(() => validatePreferences({ ...prefs, servings: 1.5 }));
});
