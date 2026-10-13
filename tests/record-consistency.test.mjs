import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProposal } from "../src/chat/model.mjs";
import { validateExpense, validateBackup } from "../src/model.mjs";
import {
  validateInventoryItem,
  validateShoppingItem,
} from "../src/fridge/model.mjs";
import { standardizeAIFoods, findFood } from "../src/nutrition/model.mjs";
const p = {
  kind: "账单",
  text: "备".repeat(500),
  name: "",
  unit: "",
  quantity: "",
  category: "餐饮",
  date: "2026-10-13",
  location: "",
  memoryKind: "",
  cents: 3500,
};
test("chat and business records accept the same long-note boundary and can be restored", () => {
  const v = validateProposal(p);
  assert.equal(validateProposal({ ...p, text: "" }).text, "");
  const e = validateExpense({
    id: "e",
    note: v.text,
    date: v.date,
    cents: v.cents,
    category: v.category,
  });
  assert.equal(
    validateBackup({ version: 1, expenses: [e] })[0].note.length,
    500,
  );
  const stock = validateProposal({
    ...p,
    kind: "食材",
    name: "食".repeat(100),
    unit: "单".repeat(20),
    quantity: "1",
    location: "冷藏",
  });
  assert.equal(
    validateInventoryItem({
      id: "i",
      name: stock.name,
      quantity: stock.quantity,
      unit: stock.unit,
      location: stock.location,
      expiry: null,
      note: stock.text,
      updatedAt: 1,
    }).note.length,
    500,
  );
  assert.equal(
    validateShoppingItem({
      id: "s",
      name: stock.name,
      quantity: stock.quantity,
      unit: stock.unit,
      note: stock.text,
      recipeName: "",
      checked: false,
      stocked: false,
      updatedAt: 1,
    }).note.length,
    500,
  );
  assert.throws(() => validateProposal({ ...p, text: "备".repeat(501) }));
  assert.throws(() => validateExpense({ ...e, note: "备".repeat(501) }));
});
test("known food macros use dictionary while unknown dishes keep explicitly estimated nutrition", () => {
  const input = {
    name: "熟米饭",
    grams: 150,
    per100: { kcal: 500, protein: 3, carbs: 70, fat: 1 },
    assumption: "按用户份量",
    confidence: "medium",
  };
  const known = standardizeAIFoods([input])[0];
  assert.deepEqual(known.per100, findFood("熟米饭").per100);
  assert.equal(known.grams, 150);
  assert.match(known.assumption, /营养采用/);
  const unknown = { ...input, name: "自创火星炖菜" };
  assert.deepEqual(standardizeAIFoods([unknown])[0], unknown);
});
