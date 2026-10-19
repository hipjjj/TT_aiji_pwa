import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildScopedBackup,
  validateScopedBackup,
  backupScopes,
} from "../src/backup/model.mjs";
import { validateBackup, validateBudgetBackup } from "../src/model.mjs";
import {
  validateNutritionBackup,
  makePortion,
  findFood,
} from "../src/nutrition/model.mjs";
import {
  validateFridgeBackup,
  defaultPreferences,
} from "../src/fridge/model.mjs";
import { validateTravelBackup } from "../src/travel/model.mjs";
import { validateOverseasBackup } from "../src/travel/overseas-model.mjs";
import { validateChatBackup } from "../src/chat/model.mjs";
import { validatePersonalFoodBackup } from "../src/nutrition/personal-foods.mjs";
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=";
const fixture = () => ({
  expenses: [
    {
      id: "expense",
      date: "2026-10-19",
      cents: 2000,
      category: "餐饮",
      note: "private-bill",
    },
  ],
  budgets: [{ month: "2026-10", cents: 50000 }],
  meals: [
    {
      id: "meal",
      date: "2026-10-19",
      mealType: "午餐",
      items: [makePortion(findFood("米饭"), 100)],
      note: "private-meal",
      photo,
      expenseId: "expense",
      updatedAt: 1,
    },
  ],
  profile: null,
  personalFoods: [],
  inventory: [],
  shopping: [],
  preferences: defaultPreferences,
  trips: [],
  visitedCities: [],
  spots: [],
  overseasTrips: [],
  threads: [
    { id: "thread", mode: "鲍比", title: "private-chat", updatedAt: 1 },
  ],
  messages: [
    {
      id: "message",
      threadId: "thread",
      speaker: "用户",
      text: "private-message",
      photo,
      proposals: [],
      createdAt: 1,
    },
  ],
  drafts: [],
  memories: [
    { id: "memory", kind: "偏好", text: "private-memory", updatedAt: 1 },
  ],
  growth: null,
  settings: { apiKey: "never-export" },
  accessCode: "never-export",
});
function validate(data) {
  validateScopedBackup(data);
  validateBackup(data);
  validateBudgetBackup(data);
  validateNutritionBackup(data);
  validateFridgeBackup(data);
  validateTravelBackup(data);
  validateOverseasBackup(data);
  validateChatBackup(data);
  validatePersonalFoodBackup(data);
}
test("each module produces a compatible backup containing only its whitelisted sections", () => {
  const allowed = {
    all: [
      "version",
      "exportScope",
      "expenses",
      "budgets",
      "nutrition",
      "personalFoods",
      "fridge",
      "travel",
      "overseas",
      "chat",
    ],
    bills: ["version", "exportScope", "expenses", "budgets"],
    nutrition: [
      "version",
      "exportScope",
      "expenses",
      "personalFoods",
      "nutrition",
      "nutritionExpenseLinksOmitted",
    ],
    fridge: ["version", "exportScope", "expenses", "fridge"],
    travel: ["version", "exportScope", "expenses", "travel", "overseas"],
    chat: ["version", "exportScope", "expenses", "chat"],
    personal: ["version", "exportScope", "expenses", "chat"],
  };
  for (const { id } of backupScopes) {
    const data = buildScopedBackup(fixture(), id, true);
    validate(data);
    assert.deepEqual(Object.keys(data).sort(), allowed[id].sort());
    assert(!JSON.stringify(data).includes("never-export"));
    if (!["bills", "all"].includes(id)) assert.deepEqual(data.expenses, []);
  }
});
test("nutrition export omits linked bills and their IDs without mutating live meals; full backup retains links", () => {
  const snapshot = fixture(),
    only = buildScopedBackup(snapshot, "nutrition", false),
    full = buildScopedBackup(snapshot, "all", true);
  assert.equal(only.nutrition.meals[0].expenseId, null);
  assert.equal(only.nutrition.meals[0].photo, null);
  assert.equal(only.nutritionExpenseLinksOmitted, true);
  assert(!JSON.stringify(only).includes("private-bill"));
  assert.equal(snapshot.meals[0].expenseId, "expense");
  assert.equal(full.nutrition.meals[0].expenseId, "expense");
  assert.equal(full.nutrition.meals[0].photo, photo);
});
test("personal scope contains only confirmed memory and growth while chat includes history and optional photos", () => {
  const personal = buildScopedBackup(fixture(), "personal", true);
  assert.deepEqual(personal.chat.threads, []);
  assert.deepEqual(personal.chat.messages, []);
  assert(!Object.hasOwn(personal.chat, "drafts"));
  assert.equal(personal.chat.memories[0].text, "private-memory");
  assert(!JSON.stringify(personal).includes("private-message"));
  const chat = buildScopedBackup(fixture(), "chat", false);
  assert.equal(chat.chat.messages[0].photo, undefined);
  assert.equal(chat.chat.photosIncluded, false);
  assert(!Object.hasOwn(chat, "nutrition"));
});
test("scoped import rejects disguised other-module data and malformed detached links, while legacy backup stays valid", () => {
  const only = buildScopedBackup(fixture(), "nutrition", true);
  assert.throws(() => validateScopedBackup({ ...only, fridge: {} }));
  assert.throws(() =>
    validateScopedBackup({ ...only, expenses: fixture().expenses }),
  );
  assert.throws(() =>
    validateScopedBackup({ ...only, nutritionExpenseLinksOmitted: false }),
  );
  assert.throws(() =>
    validateScopedBackup({
      ...only,
      nutrition: { ...only.nutrition, meals: fixture().meals },
    }),
  );
  assert.throws(() => buildScopedBackup(fixture(), "invalid"));
  assert.doesNotThrow(() => validateScopedBackup({ version: 1, expenses: [] }));
});

test("a declared module backup must contain the matching section before import", () => {
  assert.throws(() =>
    validateScopedBackup({ version: 1, exportScope: "fridge", expenses: [] }),
  );
  assert.throws(() =>
    validateScopedBackup({
      version: 1,
      exportScope: "personal",
      expenses: [],
      chat: { threads: [{}], messages: [] },
    }),
  );
});
