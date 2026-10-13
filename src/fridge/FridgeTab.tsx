import {recordLimits} from '../recordLimits.mjs';
import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { parseAmount, validDate } from "../model.mjs";
import { localDate, validateMeal } from "../nutrition/model.mjs";
import { Modal } from "../nutrition/NutritionTab";
import { fridgeCopy as copy } from "./copy";
import {
  assessRecipe,
  defaultPreferences,
  expiryStatus,
  formatQuantity,
  ingredientKey,
  locations,
  pantryOptions,
  recipeLibrary,
  recipeMealPortions,
  recommendRecipes,
  shoppingFromAssessment,
  sortedInventory,
  validateAIRecipeResult,
  validateInventoryItem,
  validatePreferences,
  validateShoppingItem,
} from "./model.mjs";
import type {
  FridgePreferences,
  InventoryItem,
  Recipe,
  RecipeIngredient,
  ShoppingItem,
  StockUpdate,
  StoragePlace,
} from "./types";
import type { Meal, MealType } from "../nutrition/types";
import "./style.css";
const units = [
  "",
  "个",
  "克",
  "千克",
  "毫升",
  "升",
  "袋",
  "盒",
  "根",
  "颗",
  "份",
  "把",
];
const emptyStock = () => ({
  name: "",
  quantity: "",
  unit: "",
  location: "冷藏" as StoragePlace,
  expiry: "",
  note: "",
});
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "暂时没有保存成功，请重试";
type MatchedIngredient = RecipeIngredient & {
  stock: {
    status: string;
    available: number;
    missing: number | null;
    matches: InventoryItem[];
    note: string;
  };
};
type Assessment = {
  recipe: Recipe;
  matches: MatchedIngredient[];
  missing: MatchedIngredient[];
  checks: MatchedIngredient[];
  urgent: string[];
  blocked: string[];
  nutrition: ReturnType<typeof import("./model.mjs").recipeNutrition>;
  status: string;
};
type PurchaseDraft = {
  shoppingId: string;
  name: string;
  quantity: string;
  unit: string;
  location: StoragePlace;
  expiry: string;
};
function QuantityFields({
  quantity,
  unit,
  onQuantity,
  onUnit,
  prefix = "",
}: {
  quantity: string;
  unit: string;
  onQuantity: (value: string) => void;
  onUnit: (value: string) => void;
  prefix?: string;
}) {
  return (
    <div className="fridge-quantity">
      <label>
        数量（可选）
        <input
          aria-label={`${prefix}数量`}
          value={quantity}
          maxLength={40}
          onChange={(event) => onQuantity(event.target.value)}
          placeholder="例如 6、半袋、一些"
        />
      </label>
      <label>
        单位（可选）
        <select
          aria-label={`${prefix}单位`}
          value={unit}
          onChange={(event) => onUnit(event.target.value)}
        >
          {[...new Set([...units, unit])].map((value) => (
            <option key={value} value={value}>
              {value || "不填写"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function MacroEstimate({ assessment }: { assessment: Assessment }) {
  const n = assessment.nutrition;
  return (
    <div className="fridge-macros">
      <span>{n.complete ? "每人份估算" : "已匹配食材的小计 · 数据不全"}</span>
      <b>{n.perServing.kcal} kcal</b>
      <p>
        蛋白质 {n.perServing.protein}g · 碳水 {n.perServing.carbs}g · 脂肪{" "}
        {n.perServing.fat}g
      </p>
      {!n.complete && (
        <small>未计入：{n.missing.join("、")}，不能视作整餐营养。</small>
      )}
    </div>
  );
}
export default function FridgeTab({
  onDataChange,
  onManageAI,
  initialView,
}: {
  initialView?:"inventory"|"shopping";
  onDataChange: () => Promise<void>;
  onManageAI: () => void;
}) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]),
    [shopping, setShopping] = useState<ShoppingItem[]>([]),
    [preferences, setPreferences] = useState<FridgePreferences>(
      defaultPreferences as FridgePreferences,
    );
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [view, setView] = useState<"inventory" | "recipes" | "shopping">(
      initialView||"inventory",
    ),
    [place, setPlace] = useState("全部"),
    [stockSearch, setStockSearch] = useState("");
  const [itemOpen, setItemOpen] = useState(false),
    [editing, setEditing] = useState<InventoryItem | null>(null),
    [stockDraft, setStockDraft] = useState(emptyStock);
  const [prefsOpen, setPrefsOpen] = useState(false),
    [prefsDraft, setPrefsDraft] = useState<FridgePreferences>(
      defaultPreferences as FridgePreferences,
    );
  const [query, setQuery] = useState(""),
    [recipeFilter, setRecipeFilter] = useState("全部"),
    [selected, setSelected] = useState<Recipe | null>(null);
  const [aiRecipes, setAIRecipes] = useState<Recipe[]>([]),
    [aiNote, setAINote] = useState(""),
    [aiConsent, setAIConsent] = useState(false),
    [asking, setAsking] = useState(false);
  const [apiURL,setAPIURL]=useState('');
  const [access]=useState(()=>sessionStorage.getItem('xiaobao-ai-access')||'');
  const abort = useRef<AbortController | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false),
    [editingShop, setEditingShop] = useState<ShoppingItem | null>(null),
    [shopDraft, setShopDraft] = useState({
      name: "",
      quantity: "",
      unit: "",
      note: "",
    });
  const [purchaseOpen, setPurchaseOpen] = useState(false),
    [purchases, setPurchases] = useState<PurchaseDraft[]>([]),
    [purchaseSnapshot, setPurchaseSnapshot] = useState<ShoppingItem[]>([]),
    [purchaseExpense, setPurchaseExpense] = useState(false),
    [purchaseCost, setPurchaseCost] = useState(""),
    [purchaseDate, setPurchaseDate] = useState(localDate());
  const [cookOpen, setCookOpen] = useState(false),
    [cookRecipe, setCookRecipe] = useState<Recipe | null>(null),
    [cookSnapshot, setCookSnapshot] = useState<InventoryItem[]>([]),
    [stockUpdates, setStockUpdates] = useState<StockUpdate[]>([]),
    [cookConfirmed, setCookConfirmed] = useState(false),
    [recordMeal, setRecordMeal] = useState(false),
    [eaten, setEaten] = useState("1"),
    [mealDate, setMealDate] = useState(localDate()),
    [mealType, setMealType] = useState<MealType>("晚餐");
  const reload = async () => {
    const [items, list, prefs, settings] = await Promise.all([
      db.inventory.toArray(),
      db.shopping.toArray(),
      db.fridgePreferences.get("main"),
      db.settings.get("ai"),
    ]);
    setInventory(sortedInventory(items) as InventoryItem[]);
    setShopping(
      list.sort(
        (a, b) =>
          Number(a.stocked) - Number(b.stocked) ||
          Number(a.checked) - Number(b.checked) ||
          b.updatedAt - a.updatedAt,
      ),
    );
    setPreferences(prefs || (defaultPreferences as FridgePreferences));
    setAPIURL(
      settings ? settings.url : import.meta.env.VITE_NUTRITION_API_URL || "",
    );
  };
  useEffect(() => {
    reload()
      .then(() => setReady(true))
      .catch(() => setMessage("嘟嘟糕打不开本地冰箱，请检查浏览器存储设置"));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const notice = (value: string) => {
    setMessage(value);
    setError("");
  };
  const openItem = (item?: InventoryItem) => {
    setEditing(item || null);
    setStockDraft(
      item
        ? {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            location: item.location,
            expiry: item.expiry || "",
            note: item.note,
          }
        : emptyStock(),
    );
    setError("");
    setItemOpen(true);
  };
  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const value = validateInventoryItem({
        ...stockDraft,
        id: editing?.id || crypto.randomUUID(),
        expiry: stockDraft.expiry || null,
        updatedAt: Date.now(),
      }) as InventoryItem;
      await db.inventory.put(value);
      await reload();
      setItemOpen(false);
      notice(editing ? "食材资料更新好啦" : copy.saved);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const removeItem = async (item: InventoryItem, reason: string) => {
    if (!confirm(`${reason}「${item.name}」？这条食材记录会移出冰箱。`)) return;
    setBusy(true);
    try {
      await db.inventory.delete(item.id);
      await reload();
      notice(
        reason === "丢弃"
          ? "嘟嘟糕记下了，下次一起少浪费一点"
          : "这份食材用完啦，嘟嘟糕收好空位了",
      );
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const openPrefs = () => {
    setPrefsDraft({ ...preferences, pantry: [...preferences.pantry] });
    setError("");
    setPrefsOpen(true);
  };
  const savePrefs = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.fridgePreferences.put(
        validatePreferences(prefsDraft) as FridgePreferences,
      );
      await reload();
      setPrefsOpen(false);
      setAIRecipes([]);
      notice("嘟嘟糕记好你的口味和常备调料啦");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const localResults = recommendRecipes(
    inventory,
    preferences,
    query,
  ) as Assessment[];
  const aiResults = aiRecipes
    .map((recipe) => assessRecipe(recipe, inventory, preferences) as Assessment)
    .filter(
      (result) =>
        !result.blocked.length &&
        result.recipe.minutes <= preferences.maxMinutes,
    );
  const results = [...localResults, ...aiResults].filter(
    (result) => recipeFilter === "全部" || result.status === recipeFilter,
  );
  const detail = selected
    ? (assessRecipe(selected, inventory, preferences) as Assessment)
    : null;
  const addRecipeShopping = async (assessment: Assessment) => {
    setBusy(true);
    try {
      const additions = shoppingFromAssessment(assessment) as ShoppingItem[];
      if (!additions.length) {
        notice("这道菜不用补食材啦");
        return;
      }
      let count = 0;
      await db.transaction("rw", db.shopping, async () => {
        const current = await db.shopping.toArray();
        for (const item of additions) {
          if (
            current.some(
              (existing) =>
                !existing.stocked &&
                existing.recipeName === item.recipeName &&
                ingredientKey(existing.name) === ingredientKey(item.name),
            )
          )
            continue;
          await db.shopping.add(validateShoppingItem(item) as ShoppingItem);
          count++;
        }
      });
      await reload();
      notice(
        count
          ? `嘟嘟糕写好 ${count} 样食材，去购物清单看看吧`
          : "这道菜的缺料已在购物清单里，请核对",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const askAI = async () => {
    const code = sessionStorage.getItem("xiaobao-ai-access") || access;
    if (!apiURL || !code) {
      setError("请先到“个人 → AI连接设置”配置服务，本地菜谱仍可使用。");
      return;
    }
    if (!navigator.onLine) {
      setError("问 AI 需要联网，本地食谱库仍可使用");
      return;
    }
    if (!aiConsent) {
      setError("请先勾选同意发送本次食材和推荐条件");
      return;
    }
    const current = inventory.filter((item) => expiryStatus(item) !== "已到期");
    if (current.length > 100) {
      setError("一次最多发送100项食材，请先整理库存");
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setAsking(true);
    setError("");
    try {
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(`${apiURL}/recipes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Access-Code": code,
          },
          body: JSON.stringify({
            mode: query.trim() ? "dish" : "inventory",
            dish: query.trim(),
            inventory: current.map(({ name, quantity, unit }) => ({
              name,
              quantity,
              unit,
            })),
            preferences,
          }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "AI食谱服务暂时不可用");
        const result = validateAIRecipeResult(body);
        const allowed = (result.recipes as Recipe[]).filter(
          (recipe) =>
            !assessRecipe(recipe, inventory, preferences).blocked.length &&
            recipe.minutes <= preferences.maxMinutes,
        );
        setAIRecipes(allowed);
        setAINote(result.note);
        notice(
          allowed.length
            ? `嘟嘟糕问到 ${allowed.length} 道菜，请核对食材和做法`
            : "AI没有返回符合当前条件的菜，可以调整条件再试",
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      setError(
        controller.signal.aborted
          ? "已停止分析，可继续查看本地食谱"
          : errorText(error),
      );
    } finally {
      setAsking(false);
      abort.current = null;
    }
  };
  const openShop = (item?: ShoppingItem) => {
    setEditingShop(item || null);
    setShopDraft(
      item
        ? {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note,
          }
        : { name: "", quantity: "", unit: "", note: "" },
    );
    setError("");
    setShoppingOpen(true);
  };
  const saveShop = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.shopping.put(
        validateShoppingItem({
          ...shopDraft,
          id: editingShop?.id || crypto.randomUUID(),
          recipeName: editingShop?.recipeName || "",
          checked: editingShop?.checked || false,
          stocked: false,
          updatedAt: Date.now(),
        }) as ShoppingItem,
      );
      await reload();
      setShoppingOpen(false);
      notice("购物小纸条写好啦");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const toggleShop = async (item: ShoppingItem) => {
    if (item.stocked) return;
    setShopping((previous) =>
      previous.map((row) =>
        row.id === item.id ? { ...row, checked: !item.checked } : row,
      ),
    );
    setBusy(true);
    try {
      await db.shopping.update(item.id, {
        checked: !item.checked,
        updatedAt: Date.now(),
      });
      await reload();
    } catch (error) {
      setShopping((previous) =>
        previous.map((row) => (row.id === item.id ? item : row)),
      );
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const removeShop = async (item: ShoppingItem) => {
    if (!confirm(`移除购物清单中的「${item.name}」？已放入冰箱的食材会保留。`))
      return;
    setBusy(true);
    try {
      await db.shopping.delete(item.id);
      await reload();
      notice("购物纸条整理好啦");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const openPurchase = () => {
    const items = shopping.filter((item) => item.checked && !item.stocked);
    if (!items.length) {
      notice("先勾选已经买到的食材吧");
      return;
    }
    setPurchaseSnapshot(items);
    setPurchases(
      items.map((item) => ({
        shoppingId: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        location: "冷藏",
        expiry: "",
      })),
    );
    setPurchaseExpense(false);
    setPurchaseCost("");
    setPurchaseDate(localDate());
    setError("");
    setPurchaseOpen(true);
  };
  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (!validDate(purchaseDate)) throw new Error("购买日期无效");
      const now = Date.now();
      const items = purchases.map(
        (item) =>
          validateInventoryItem({
            ...item,
            id: crypto.randomUUID(),
            expiry: item.expiry || null,
            note: "从购物清单放入冰箱",
            updatedAt: now,
          }) as InventoryItem,
      );
      const expense = purchaseExpense
        ? {
            id: crypto.randomUUID(),
            date: purchaseDate,
            category: "食品日用",
            cents: parseAmount(purchaseCost),
            note: `嘟嘟糕采购：${purchases.map((item) => item.name).join("、")}`.slice(
              0,
              200,
            ),
          }
        : null;
      await db.transaction(
        "rw",
        db.inventory,
        db.shopping,
        db.expenses,
        async () => {
          for (const previous of purchaseSnapshot) {
            const current = await db.shopping.get(previous.id);
            if (
              !current ||
              current.stocked ||
              !current.checked ||
              current.updatedAt !== previous.updatedAt
            )
              throw new Error("购物清单已变化，请重新确认采购");
          }
          await db.inventory.bulkAdd(items);
          for (const item of purchaseSnapshot)
            await db.shopping.update(item.id, {
              stocked: true,
              updatedAt: now,
            });
          if (expense) await db.expenses.add(expense);
        },
      );
      await reload();
      await onDataChange();
      setPurchaseOpen(false);
      notice(`放进冰箱啦！${expense ? "鲍比也收好了采购小票" : ""}`);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const openCook = (assessment: Assessment) => {
    const matched = [
      ...new Map(
        assessment.matches
          .flatMap((item) => item.stock.matches)
          .map((item) => [item.id, item]),
      ).values(),
    ] as InventoryItem[];
    setCookRecipe(assessment.recipe as Recipe);
    setCookSnapshot(matched);
    setStockUpdates(
      matched.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unit: item.unit,
        action: "keep",
      })),
    );
    setCookConfirmed(false);
    setRecordMeal(false);
    setEaten("1");
    setMealDate(localDate());
    setMealType("晚餐");
    setSelected(null);
    setError("");
    setCookOpen(true);
  };
  const saveCook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cookRecipe) return;
    setBusy(true);
    try {
      if (!cookConfirmed) throw new Error("请确认实际使用的食材和剩余数量");
      let meal: Meal | null = null;
      if (recordMeal) {
        const portions = Number(eaten);
        if (
          !Number.isFinite(portions) ||
          portions <= 0 ||
          portions > cookRecipe.servings
        )
          throw new Error("个人食用份数须大于0且不超过制作份数");
        meal = validateMeal({
          id: crypto.randomUUID(),
          date: mealDate,
          mealType,
          items: recipeMealPortions(cookRecipe, portions),
          note: `嘟嘟糕做的${cookRecipe.name} · 个人约${portions}人份`,
          photo: null,
          expenseId: null,
          updatedAt: Date.now(),
        }) as Meal;
      }
      const changes = stockUpdates.filter((item) => item.action !== "keep");
      await db.transaction("rw", db.inventory, db.meals, async () => {
        for (const update of changes) {
          const original = cookSnapshot.find((item) => item.id === update.id)!;
          const current = await db.inventory.get(update.id);
          if (!current || current.updatedAt !== original.updatedAt)
            throw new Error("食材库存已变化，请重新确认做菜用量");
          if (update.action === "used") await db.inventory.delete(update.id);
          else
            await db.inventory.put(
              validateInventoryItem({
                ...current,
                quantity: update.quantity,
                unit: update.unit,
                updatedAt: Date.now(),
              }) as InventoryItem,
            );
        }
        if (meal) await db.meals.add(meal);
      });
      await reload();
      setCookOpen(false);
      notice(
        meal
          ? "好好吃饭啦！小包也收好这餐的营养记录了"
          : "做菜确认好啦，嘟嘟糕整理好冰箱了",
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  const modalProps = { eyebrow: copy.eyebrow, className: "fridge-dialog" };
  const modalError = error && (
    <p className="nutrition-error" role="alert">
      {error}
    </p>
  );
  const urgent = inventory.filter((item) =>
    ["已到期", "今天到期", "快到期"].includes(expiryStatus(item)),
  );
  const shown = inventory.filter(
    (item) =>
      (place === "全部" || item.location === place) &&
      (!stockSearch || item.name.includes(stockSearch)),
  );
  const pending = shopping.filter((item) => !item.checked).length;
  return (
    <section className="fridge-house">
      <div className="fridge-heading">
        <div>
          <span className="park-label">Dudu Gao’s Little Kitchen</span>
          <h2>{copy.name}</h2>
        </div>
        <button
          className="nutrition-soft-button"
          onClick={openPrefs}
          disabled={!ready || busy || asking}
        >
          口味与调料
        </button>
      </div>
      <div className="fridge-overview">
        <div>
          <span>冰箱里的小伙伴</span>
          <b>
            {inventory.length}
            <small>样</small>
          </b>
        </div>
        <div>
          <span>要先照顾的食材</span>
          <b>
            {urgent.length}
            <small>样</small>
          </b>
        </div>
        <div>
          <span>购物小纸条</span>
          <b>
            {pending}
            <small>样待买</small>
          </b>
        </div>
      </div>
      <div className="fridge-view" role="group" aria-label="冰箱功能">
        <button
          aria-pressed={view === "inventory"}
          onClick={() => {
            setView("inventory");
            setError("");
          }}
        >
          我的冰箱
        </button>
        <button
          aria-pressed={view === "recipes"}
          onClick={() => {
            setView("recipes");
            setError("");
          }}
        >
          今天吃什么
        </button>
        <button
          aria-pressed={view === "shopping"}
          onClick={() => {
            setView("shopping");
            setError("");
          }}
        >
          购物清单
        </button>
      </div>
      {!ready ? (
        <p className="empty">嘟嘟糕正在打开冰箱门…</p>
      ) : (
        <>
          {view === "inventory" && (
            <>
              <button
                className="new-expense fridge-add"
                disabled={busy}
                onClick={() => openItem()}
              >
                <span>＋</span> 放点食材进来 <span aria-hidden="true">🥕</span>
              </button>
              {urgent.length > 0 && (
                <div className="fridge-urgent">
                  <strong>嘟嘟糕提醒：这几样先看看 ♡</strong>
                  <p>
                    {urgent
                      .map((item) => `${item.name}（${expiryStatus(item)}）`)
                      .join("、")}
                  </p>
                  <small>
                    日期仅作提醒；已到期食材不计入推荐，请先检查并处理。
                  </small>
                </div>
              )}
              <div className="fridge-search">
                <label>
                  <span className="sr-only">查找冰箱食材</span>
                  <input
                    aria-label="查找冰箱食材"
                    placeholder="找找冰箱里有什么…"
                    value={stockSearch}
                    onChange={(event) => setStockSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="fridge-zones">
                {["全部", ...locations].map((zone) => (
                  <button
                    key={zone}
                    aria-pressed={place === zone}
                    onClick={() => setPlace(zone)}
                  >
                    {zone}{" "}
                    <small>
                      {zone === "全部"
                        ? inventory.length
                        : inventory.filter((item) => item.location === zone)
                            .length}
                    </small>
                  </button>
                ))}
              </div>
              {!shown.length ? (
                <div className="empty">
                  <span className="fridge-empty-icon" aria-hidden="true">
                    🥕
                  </span>
                  <h3>
                    {inventory.length ? "这里还没有匹配的食材" : copy.empty}
                  </h3>
                  <p>几个、半袋、一些，都可以先记下来。</p>
                </div>
              ) : (
                <div className="fridge-stock-grid">
                  {shown.map((item) => {
                    const status = expiryStatus(item);
                    return (
                      <article
                        className={`fridge-stock ${status === "已到期" ? "stock-expired" : ""}`}
                        key={item.id}
                      >
                        <div className="fridge-stock-top">
                          <span
                            className="fridge-ingredient-icon"
                            aria-hidden="true"
                          >
                            {ingredientKey(item.name).includes("肉")
                              ? "🍗"
                              : ingredientKey(item.name) === "鸡蛋"
                                ? "🥚"
                                : ingredientKey(item.name) === "牛奶"
                                  ? "🥛"
                                  : "🥬"}
                          </span>
                          <span
                            className={`expiry-chip ${["今天到期", "快到期", "已到期"].includes(status) ? "expiry-soon" : ""}`}
                          >
                            {status}
                          </span>
                        </div>
                        <h3>{item.name}</h3>
                        <p className="stock-amount">
                          {item.quantity
                            ? formatQuantity(item.quantity, item.unit)
                            : "数量待补充"}
                        </p>
                        <p className="stock-place">
                          {item.location}
                          {item.expiry ? ` · ${item.expiry}` : ""}
                        </p>
                        {item.note && <p className="stock-note">{item.note}</p>}
                        <div className="fridge-stock-actions">
                          <button
                            disabled={busy}
                            onClick={() => openItem(item)}
                            aria-label={`编辑食材${item.name}`}
                          >
                            编辑
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void removeItem(item, "用完了")}
                            aria-label={`用完${item.name}`}
                          >
                            用完了
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void removeItem(item, "丢弃")}
                            aria-label={`丢弃${item.name}`}
                          >
                            丢弃
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {view === "recipes" && (
            <>
              <div className="fridge-recipe-intro">
                <span className="park-label">What’s for Dinner?</span>
                <h3>有点食材，就有点期待</h3>
                <p>
                  {preferences.servings} 人份 · {preferences.maxMinutes} 分钟内
                  · {preferences.preference}
                  <br />
                  优先照顾快到期的食材，模糊份量一起核对。
                </p>
              </div>
              <label className="fridge-dish-search">
                今天想吃什么？
                <input
                  aria-label="想吃的菜"
                  disabled={asking}
                  placeholder="输入菜名，或留空按库存推荐"
                  maxLength={recordLimits.name}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setAIRecipes([]);
                    setAINote("");
                  }}
                />
              </label>
              <div className="analysis-actions">
                <button
                  disabled={asking || busy}
                  onClick={() => {
                    setAIRecipes([]);
                    setAINote("");
                    setRecipeFilter("全部");
                    setError("");
                    notice("嘟嘟糕按冰箱库存和口味，整理好本地食谱啦");
                  }}
                >
                  {copy.local}
                  <small>20 道家常菜 · 无需联网</small>
                </button>
                <button
                  className="ai-calculate"
                  disabled={asking || busy}
                  onClick={() => void askAI()}
                >
                  {copy.ai}
                  <small>{apiURL ? "联网找新灵感" : "需要连接 AI 服务"}</small>
                </button>
              </div>
              <label className="nutrition-checkbox fridge-consent">
                <input
                  type="checkbox"
                  checked={aiConsent}
                  disabled={asking}
                  onChange={(event) => setAIConsent(event.target.checked)}
                />
                <span>
                  点击问 AI
                  时，同意发送本次食材名称、数量、想吃的菜和推荐条件；不发送照片、账单或身体资料。
                </span>
              </label>
              {asking && (
                <div className="analysis-working" role="status">
                  嘟嘟糕正在问今天的菜谱…
                  <button onClick={() => abort.current?.abort()}>停止</button>
                </div>
              )}
              {error && (
                <p className="nutrition-error" role="alert">
                  {error}
                </p>
              )}
              <div className="fridge-recipe-options">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.showNutrition}
                    disabled={busy}
                    onChange={async (event) => {
                      const previous = preferences;
                      const next = {
                        ...preferences,
                        showNutrition: event.target.checked,
                      };
                      setPreferences(next);
                      setBusy(true);
                      try {
                        await db.fridgePreferences.put(next);
                      } catch (error) {
                        setPreferences(previous);
                        setMessage(errorText(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />{" "}
                  显示营养估算
                </label>
                <button className="fridge-text-button" onClick={onManageAI}>
                  去个人页设置AI
                </button>
              </div>
              <div className="fridge-zones recipe-filters">
                {["全部", "现在就能做", "补几样就能做", "份量待核对"].map(
                  (filter) => (
                    <button
                      key={filter}
                      aria-pressed={recipeFilter === filter}
                      onClick={() => setRecipeFilter(filter)}
                    >
                      {filter}
                    </button>
                  ),
                )}
              </div>
              {aiNote && (
                <p className="nutrition-small-note">AI 提醒：{aiNote}</p>
              )}
              {(preferences.allergies || preferences.avoid) && (
                <p className="fridge-allergy-note">
                  已按填写的忌口／过敏筛选；购买时仍需核对包装和交叉接触信息。
                </p>
              )}
              {!results.length ? (
                <div className="empty">
                  <span aria-hidden="true">🍳</span>
                  <h3>暂时没有符合条件的菜</h3>
                  <p>换个菜名或调整口味条件，也可以让嘟嘟糕问 AI。</p>
                </div>
              ) : (
                <div className="fridge-recipe-grid">
                  {results.map((assessment) => (
                    <article
                      className="fridge-recipe-card"
                      key={assessment.recipe.id}
                    >
                      <div className="fridge-recipe-top">
                        <span className="recipe-emoji" aria-hidden="true">
                          {assessment.recipe.emoji}
                        </span>
                        <span
                          className={`recipe-status ${assessment.status === "现在就能做" ? "recipe-ready" : ""}`}
                        >
                          {assessment.status}
                        </span>
                      </div>
                      <h3>{assessment.recipe.name}</h3>
                      <p className="recipe-meta">
                        {assessment.recipe.minutes} 分钟 ·{" "}
                        {assessment.recipe.servings} 人份 ·{" "}
                        {assessment.recipe.source === "ai"
                          ? "AI 灵感"
                          : "本地食谱"}
                      </p>
                      <p className="recipe-stock-hint">
                        {assessment.urgent.length
                          ? `先用：${assessment.urgent.join("、")}`
                          : assessment.missing.length
                            ? `还缺：${assessment.missing.map((item) => item.name).join("、")}`
                            : assessment.checks.length
                              ? "食材在，核对一下份量就好"
                              : "食材够用，准备开饭啦"}
                      </p>
                      {preferences.showNutrition && (
                        <MacroEstimate assessment={assessment} />
                      )}
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelected(assessment.recipe as Recipe);
                          setError("");
                        }}
                      >
                        看看怎么做 <span aria-hidden="true">↗</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {view === "shopping" && (
            <>
              <div className="fridge-shopping-heading">
                <div>
                  <h3>嘟嘟糕的采购小纸条</h3>
                  <p>勾选买到了，再确认放进冰箱。</p>
                </div>
                <button
                  className="nutrition-soft-button"
                  onClick={() => openShop()}
                  disabled={busy}
                >
                  ＋ 添加
                </button>
              </div>
              <button
                className="new-expense fridge-add"
                disabled={
                  busy ||
                  !shopping.some((item) => item.checked && !item.stocked)
                }
                onClick={openPurchase}
              >
                把买到的放进冰箱 <span aria-hidden="true">🧺</span>
              </button>
              {!shopping.length ? (
                <div className="empty">
                  <span aria-hidden="true">🧺</span>
                  <h3>购物清单还空着</h3>
                  <p>从菜谱添加缺少的食材，或自己写一张小纸条。</p>
                </div>
              ) : (
                <div className="fridge-shopping-list">
                  {shopping.map((item) => (
                    <article
                      className={`fridge-shopping-row ${item.stocked ? "shopping-stocked" : ""}`}
                      key={item.id}
                    >
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`买到${item.name}`}
                          checked={item.checked}
                          disabled={busy || item.stocked}
                          onChange={() => void toggleShop(item)}
                        />
                        <div>
                          <strong>{item.name}</strong>
                          <p>
                            {item.quantity
                              ? formatQuantity(item.quantity, item.unit)
                              : "数量待核对"}
                            {item.recipeName ? ` · ${item.recipeName}` : ""}
                          </p>
                          {item.note && <small>{item.note}</small>}
                          {item.stocked && (
                            <span className="source-chip">已放进冰箱</span>
                          )}
                        </div>
                      </label>
                      <div className="shopping-row-actions">
                        {!item.stocked && (
                          <button
                            disabled={busy}
                            onClick={() => openShop(item)}
                            aria-label={`修改购物${item.name}`}
                          >
                            修改
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void removeShop(item)}
                          aria-label={`移除购物${item.name}`}
                        >
                          移除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
      <Modal
        {...modalProps}
        open={itemOpen}
        onClose={() => {
          if (!busy) setItemOpen(false);
        }}
        title={editing ? "编辑冰箱食材" : "放点食材进来"}
      >
        <form onSubmit={saveItem} noValidate>
          {modalError}
          <label>
            食材名称
            <input
              aria-label="食材名称"
              maxLength={recordLimits.name}
              value={stockDraft.name}
              onChange={(event) =>
                setStockDraft({ ...stockDraft, name: event.target.value })
              }
              placeholder="例如 鸡蛋、西红柿"
            />
          </label>
          <QuantityFields
            quantity={stockDraft.quantity}
            unit={stockDraft.unit}
            onQuantity={(quantity) =>
              setStockDraft({ ...stockDraft, quantity })
            }
            onUnit={(unit) => setStockDraft({ ...stockDraft, unit })}
          />
          <div className="meal-form-top">
            <label>
              存放位置
              <select
                aria-label="存放位置"
                value={stockDraft.location}
                onChange={(event) =>
                  setStockDraft({
                    ...stockDraft,
                    location: event.target.value as StoragePlace,
                  })
                }
              >
                {locations.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              到期日期（可选）
              <input
                type="date"
                aria-label="到期日期"
                value={stockDraft.expiry}
                onChange={(event) =>
                  setStockDraft({ ...stockDraft, expiry: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            备注（可选）
            <input
              aria-label="食材备注"
              maxLength={recordLimits.note}
              value={stockDraft.note}
              onChange={(event) =>
                setStockDraft({ ...stockDraft, note: event.target.value })
              }
              placeholder="例如 已开封、妈妈送的"
            />
          </label>
          <p className="nutrition-small-note">
            不用称重也能先记下来；数量不明确时，嘟嘟糕会提醒核对。
          </p>
          <button className="primary" disabled={busy}>
            {busy ? "正在放好…" : "保存食材"}
          </button>
        </form>
      </Modal>
      <Modal
        {...modalProps}
        open={prefsOpen}
        onClose={() => {
          if (!busy) setPrefsOpen(false);
        }}
        title="嘟嘟糕记记你的口味"
      >
        <form onSubmit={savePrefs} noValidate>
          {modalError}
          <div className="meal-form-top">
            <label>
              几个人吃
              <input
                aria-label="用餐人数"
                type="number"
                min="1"
                max="8"
                step="1"
                value={prefsDraft.servings}
                onChange={(event) =>
                  setPrefsDraft({
                    ...prefsDraft,
                    servings: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              最多做多久（分钟）
              <input
                aria-label="最多做饭时间"
                type="number"
                min="5"
                max="180"
                value={prefsDraft.maxMinutes}
                onChange={(event) =>
                  setPrefsDraft({
                    ...prefsDraft,
                    maxMinutes: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <label>
            过敏食材
            <input
              aria-label="过敏食材"
              maxLength={200}
              value={prefsDraft.allergies}
              onChange={(event) =>
                setPrefsDraft({ ...prefsDraft, allergies: event.target.value })
              }
              placeholder="例如 鸡蛋、奶、花生"
            />
          </label>
          <label>
            忌口／不爱吃
            <input
              aria-label="忌口食材"
              maxLength={200}
              value={prefsDraft.avoid}
              onChange={(event) =>
                setPrefsDraft({ ...prefsDraft, avoid: event.target.value })
              }
              placeholder="多个用逗号分开"
            />
          </label>
          <label>
            饮食偏好
            <select
              aria-label="饮食偏好"
              value={prefsDraft.preference}
              onChange={(event) =>
                setPrefsDraft({
                  ...prefsDraft,
                  preference: event.target
                    .value as FridgePreferences["preference"],
                })
              }
            >
              {["不限", "减脂", "高蛋白"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={prefsDraft.showNutrition}
              onChange={(event) =>
                setPrefsDraft({
                  ...prefsDraft,
                  showNutrition: event.target.checked,
                })
              }
            />
            <span>显示推荐菜的营养估算</span>
          </label>
          <fieldset className="fridge-pantry">
            <legend>家里常备的调料</legend>
            {pantryOptions.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={prefsDraft.pantry.includes(name)}
                  onChange={(event) =>
                    setPrefsDraft({
                      ...prefsDraft,
                      pantry: event.target.checked
                        ? [...prefsDraft.pantry, name]
                        : prefsDraft.pantry.filter((item) => item !== name),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </fieldset>
          <p className="nutrition-small-note">
            过敏筛选按食材名称和常见过敏原进行，不能保证加工食品无过敏原，请核对包装。
          </p>
          <button className="primary" disabled={busy}>
            保存口味与调料
          </button>
        </form>
      </Modal>
      <Modal
        {...modalProps}
        open={!!selected}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title={selected?.name || "看看这道菜"}
      >
        {detail && (
          <div className="fridge-recipe-detail">
            {modalError}
            <p className="recipe-meta">
              {detail.recipe.servings} 人份 · 约 {detail.recipe.minutes} 分钟 ·{" "}
              {detail.recipe.source === "ai"
                ? "AI 推荐，请核对做法"
                : "嘟嘟糕的家常食谱"}
            </p>
            {detail.urgent.length > 0 && (
              <p className="fridge-allergy-note">
                先照顾：{detail.urgent.join("、")}
              </p>
            )}
            <h3>需要准备这些</h3>
            <ul className="recipe-ingredients">
              {detail.matches.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <div>
                    <b>{item.name}</b>
                    <span>
                      {item.amount}
                      {item.unit}
                      {item.optional ? "（可选）" : ""}
                    </span>
                  </div>
                  <small className={`ingredient-${item.stock.status}`}>
                    {item.stock.status === "missing"
                      ? `还缺 ${item.stock.missing}${item.unit}`
                      : item.stock.note}
                  </small>
                </li>
              ))}
            </ul>
            {preferences.showNutrition && <MacroEstimate assessment={detail} />}
            <h3>跟着嘟嘟糕做</h3>
            <ol className="recipe-steps">
              {detail.recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="nutrition-small-note">{detail.recipe.note}</p>
            <button
              className="primary"
              disabled={
                busy || (!detail.missing.length && !detail.checks.length)
              }
              onClick={() => void addRecipeShopping(detail)}
            >
              把缺少／待核对的食材加入购物清单
            </button>
            <button
              className="nutrition-soft-button fridge-cook-button"
              disabled={busy}
              onClick={() => openCook(detail)}
            >
              做了这道菜 · 确认库存
            </button>
          </div>
        )}
      </Modal>
      <Modal
        {...modalProps}
        open={shoppingOpen}
        onClose={() => {
          if (!busy) setShoppingOpen(false);
        }}
        title={editingShop ? "修改购物小纸条" : "写一张购物小纸条"}
      >
        <form onSubmit={saveShop} noValidate>
          {modalError}
          <label>
            要买什么
            <input
              aria-label="购物食材名称"
              maxLength={recordLimits.name}
              value={shopDraft.name}
              onChange={(event) =>
                setShopDraft({ ...shopDraft, name: event.target.value })
              }
            />
          </label>
          <QuantityFields
            prefix="购物"
            quantity={shopDraft.quantity}
            unit={shopDraft.unit}
            onQuantity={(quantity) => setShopDraft({ ...shopDraft, quantity })}
            onUnit={(unit) => setShopDraft({ ...shopDraft, unit })}
          />
          <label>
            备注
            <input
              aria-label="购物备注"
              maxLength={recordLimits.note}
              value={shopDraft.note}
              onChange={(event) =>
                setShopDraft({ ...shopDraft, note: event.target.value })
              }
            />
          </label>
          <button className="primary" disabled={busy}>
            保存购物食材
          </button>
        </form>
      </Modal>
      <Modal
        {...modalProps}
        open={purchaseOpen}
        onClose={() => {
          if (!busy) setPurchaseOpen(false);
        }}
        title="把买到的放进冰箱"
      >
        <form onSubmit={savePurchase} noValidate>
          {modalError}
          <p className="nutrition-small-note">
            确认实际买到的数量和位置，会作为新的一份食材放入，不会覆盖原来的库存。
          </p>
          {purchases.map((item, index) => (
            <fieldset className="fridge-confirm-item" key={item.shoppingId}>
              <legend>{item.name}</legend>
              <QuantityFields
                prefix={`${item.name}采购`}
                quantity={item.quantity}
                unit={item.unit}
                onQuantity={(quantity) =>
                  setPurchases(
                    purchases.map((old, i) =>
                      i === index ? { ...old, quantity } : old,
                    ),
                  )
                }
                onUnit={(unit) =>
                  setPurchases(
                    purchases.map((old, i) =>
                      i === index ? { ...old, unit } : old,
                    ),
                  )
                }
              />
              <div className="meal-form-top">
                <label>
                  放在哪里
                  <select
                    aria-label={`${item.name}采购位置`}
                    value={item.location}
                    onChange={(event) =>
                      setPurchases(
                        purchases.map((old, i) =>
                          i === index
                            ? {
                                ...old,
                                location: event.target.value as StoragePlace,
                              }
                            : old,
                        ),
                      )
                    }
                  >
                    {locations.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  到期日期
                  <input
                    aria-label={`${item.name}采购到期日期`}
                    type="date"
                    value={item.expiry}
                    onChange={(event) =>
                      setPurchases(
                        purchases.map((old, i) =>
                          i === index
                            ? { ...old, expiry: event.target.value }
                            : old,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={purchaseExpense}
              onChange={(event) => setPurchaseExpense(event.target.checked)}
            />
            <span>同时记一笔食品日用开销 · 交给鲍比</span>
          </label>
          {purchaseExpense && (
            <div className="meal-form-top">
              <label>
                这次采购总金额
                <input
                  aria-label="采购总金额"
                  inputMode="decimal"
                  value={purchaseCost}
                  onChange={(event) => setPurchaseCost(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                购买日期
                <input
                  aria-label="购买日期"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </label>
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "正在放入…" : "确认放进冰箱"}
          </button>
        </form>
      </Modal>
      <Modal
        {...modalProps}
        open={cookOpen}
        onClose={() => {
          if (!busy) setCookOpen(false);
        }}
        title="做完啦，整理一下冰箱"
      >
        <form onSubmit={saveCook} noValidate>
          {modalError}
          <p className="nutrition-small-note">
            {cookRecipe?.name} · 制作 {cookRecipe?.servings}{" "}
            人份。按实际使用量填写剩余库存，不会自动猜测扣除。
          </p>
          {cookSnapshot.length === 0 && (
            <p className="nutrition-small-note">
              没有可匹配的现有库存；可手动添加剩余食材。
            </p>
          )}
          {stockUpdates.map((update, index) => {
            const original = cookSnapshot.find(
              (item) => item.id === update.id,
            )!;
            return (
              <fieldset className="fridge-confirm-item" key={update.id}>
                <legend>
                  {original.name} · {original.location}
                </legend>
                <p className="nutrition-small-note">
                  原来：
                  {original.quantity
                    ? formatQuantity(original.quantity, original.unit)
                    : "数量未知"}
                </p>
                <label>
                  做完后的状态
                  <select
                    aria-label={`${original.name}库存处理`}
                    value={update.action}
                    onChange={(event) =>
                      setStockUpdates(
                        stockUpdates.map((old, i) =>
                          i === index
                            ? {
                                ...old,
                                action: event.target
                                  .value as StockUpdate["action"],
                              }
                            : old,
                        ),
                      )
                    }
                  >
                    <option value="keep">还剩一些／不修改</option>
                    <option value="update">填写剩余数量</option>
                    <option value="used">已经用完了</option>
                  </select>
                </label>
                {update.action === "update" && (
                  <QuantityFields
                    prefix={`${original.name}剩余`}
                    quantity={update.quantity}
                    unit={update.unit}
                    onQuantity={(quantity) =>
                      setStockUpdates(
                        stockUpdates.map((old, i) =>
                          i === index ? { ...old, quantity } : old,
                        ),
                      )
                    }
                    onUnit={(unit) =>
                      setStockUpdates(
                        stockUpdates.map((old, i) =>
                          i === index ? { ...old, unit } : old,
                        ),
                      )
                    }
                  />
                )}
              </fieldset>
            );
          })}
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={cookConfirmed}
              onChange={(event) => setCookConfirmed(event.target.checked)}
            />
            <span>已核对实际使用的食材和剩余数量</span>
          </label>
          <label className="nutrition-checkbox">
            <input
              type="checkbox"
              checked={recordMeal}
              disabled={
                !cookRecipe ||
                !assessRecipe(cookRecipe, inventory, preferences).nutrition
                  .complete
              }
              onChange={(event) => setRecordMeal(event.target.checked)}
            />
            <span>同时生成我的饮食记录 · 交给小包</span>
          </label>
          {cookRecipe &&
            !assessRecipe(cookRecipe, inventory, preferences).nutrition
              .complete && (
              <p className="nutrition-small-note">
                部分食材没有营养数据，请到营养屋手动核对后记录。
              </p>
            )}
          {recordMeal && (
            <>
              <label>
                我吃了几人份
                <input
                  aria-label="个人食用份数"
                  type="number"
                  min="0.1"
                  max={cookRecipe?.servings}
                  step="0.1"
                  value={eaten}
                  onChange={(event) => setEaten(event.target.value)}
                />
              </label>
              <div className="meal-form-top">
                <label>
                  用餐日期
                  <input
                    aria-label="做菜用餐日期"
                    type="date"
                    value={mealDate}
                    onChange={(event) => setMealDate(event.target.value)}
                  />
                </label>
                <label>
                  餐次
                  <select
                    aria-label="做菜餐次"
                    value={mealType}
                    onChange={(event) =>
                      setMealType(event.target.value as MealType)
                    }
                  >
                    {["早餐", "午餐", "晚餐", "加餐"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="nutrition-small-note">
                只记录你吃的份量，不把整锅菜都算到你一个人身上。
              </p>
            </>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "正在整理…" : "确认完成做菜"}
          </button>
        </form>
      </Modal>
      {!itemOpen &&
        !prefsOpen &&
        !selected &&
        !shoppingOpen &&
        !purchaseOpen &&
        !cookOpen && (
          <div className={`toast ${message ? "visible" : ""}`} role="status">
            {message}
          </div>
        )}
    </section>
  );
}
