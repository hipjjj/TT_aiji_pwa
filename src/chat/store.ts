import { validateExpense } from "../model.mjs";
import {
  validateInventoryItem,
  validateShoppingItem,
} from "../fridge/model.mjs";
import { findFood, validateMeal } from "../nutrition/model.mjs";
import type { Expense, Meal, FoodDefinition } from "../nutrition/types";
import type { InventoryItem, ShoppingItem } from "../fridge/types";
import { db } from "../db";
import { grow, validateProposal } from "./model.mjs";
import type { ChatMessage, Proposal, ChatGrowth } from "./types";
export async function resolveProposal(
  messageId: string,
  proposalId: string,
  accept: boolean,
  edited: Proposal,
) {
  await db.transaction(
    "rw",
    [
      db.chatMessages,
      db.chatMemories,
      db.chatGrowth,
      db.expenses,
      db.inventory,
      db.shopping,
      db.meals,
    ],
    async () => {
      const message = await db.chatMessages.get(messageId);
      const original = message?.proposals.find((p) => p.id === proposalId);
      if (!message || !original || original.status !== "pending")
        throw Error("这张卡片已经处理过了");
      if (accept) {
        const p = validateProposal(edited) as Proposal;
        if (p.kind !== original.kind) throw Error("操作类型不能修改");
        const now = Date.now(),
          id = "chat-" + proposalId;
        if (p.kind === "记忆") {
          await db.chatMemories.add({
            id,
            kind: p.memoryKind as "偏好",
            text: p.text,
            updatedAt: now,
          });
        }
        if (p.kind === "成长") {
          const state = grow(await db.chatGrowth.get("main"), now);
          state.events = [...state.events, { at: now, text: p.text }];
          await db.chatGrowth.put(state as ChatGrowth);
        }
        if (p.kind === "账单")
          await db.expenses.add(
            validateExpense({
              id,
              cents: p.cents,
              category: p.category,
              date: p.date,
              note: p.text,
            }) as Expense,
          );
        if (p.kind === "食材")
          await db.inventory.add(
            validateInventoryItem({
              id,
              name: p.name,
              quantity: p.quantity,
              unit: p.unit,
              location: p.location as "冷藏",
              expiry: null,
              note: p.text,
              updatedAt: now,
            }) as InventoryItem,
          );
        if (p.kind === "饮食")
          await db.meals.add(
            validateMeal({
              id,
              date: p.date,
              mealType: p.mealType as import("../nutrition/types").MealType,
              items: (p.foods || []).map((food) => {
                const matched = findFood(food.name) as FoodDefinition | undefined;
                const known = matched?.estimated ? undefined : matched;
                return {
                  ...food,
                  id: crypto.randomUUID(),
                  ...(known ? { foodId: known.id } : {}),
                  source: food.assumption.endsWith("；营养数值由用户调整。")
                    ? ("manual" as const)
                    : ("ai" as const),
                  sourceLabel: food.assumption.endsWith(
                    "；营养数值由用户调整。",
                  )
                    ? "用户调整 · 企鹅小家"
                    : known
                      ? `AI识别 + ${known.reference} · ${known.sourceId}`
                      : "AI估算 · 企鹅小家",
                };
              }),
              note: p.text,
              photo: null,
              expenseId: null,
              updatedAt: now,
            }) as Meal,
          );
        if (p.kind === "购物")
          await db.shopping.add(
            validateShoppingItem({
              id,
              name: p.name,
              quantity: p.quantity,
              unit: p.unit,
              note: p.text,
              recipeName: "",
              checked: false,
              stocked: false,
              updatedAt: now,
            }) as ShoppingItem,
          );
      }
      await db.chatMessages.put({
        ...message,
        proposals: message.proposals.map((p) =>
          p.id === proposalId
            ? {
                ...(accept ? edited : p),
                id: p.id,
                status: accept ? "accepted" : "dismissed",
              }
            : p,
        ),
      } as ChatMessage);
    },
  );
}
