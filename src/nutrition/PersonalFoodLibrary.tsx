import React, { useState } from "react";
import { db } from "../db";
import { Modal } from "./NutritionTab";
import {
  validatePersonalFood,
  checkPersonalFoodNames,
} from "./personal-foods.mjs";
import type { PersonalFood, NutrientKey } from "./types";
const nutrients: { key: NutrientKey; name: string }[] = [
  { key: "kcal", name: "热量" },
  { key: "protein", name: "蛋白质" },
  { key: "carbs", name: "碳水" },
  { key: "fat", name: "脂肪" },
];
export default function PersonalFoodLibrary({
  items,
  onChange,
}: {
  items: PersonalFood[];
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<PersonalFood | null>(null),
    [aliases, setAliases] = useState(""),
    [fist, setFist] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const edit = (food: PersonalFood) => {
    setEditing({ ...food, per100: { ...food.per100 } });
    setAliases(food.aliases.join("、"));
    setFist(food.gramsPerFist === null ? "" : String(food.gramsPerFist));
    setError("");
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const food = validatePersonalFood({
        ...editing,
        aliases: aliases
          .split(/[、,，;；\n]/)
          .map((x) => x.trim())
          .filter(Boolean),
        gramsPerFist: fist.trim() ? Number(fist) : null,
        updatedAt: Date.now(),
      }) as PersonalFood;
      await db.transaction("rw", db.personalFoods, async () => {
        checkPersonalFoodNames([
          ...(await db.personalFoods.toArray()).filter((x) => x.id !== food.id),
          food,
        ]);
        await db.personalFoods.put(food);
      });
      await onChange();
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (food: PersonalFood) => {
    if (!confirm(`删除“${food.name}”？已保存的餐食不会改变。`)) return;
    setBusy(true);
    try {
      await db.personalFoods.delete(food.id);
      await onChange();
      setError("");
    } catch {
      setError("删除失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="personal-food-library">
      <details>
        <summary>我的食物库 · {items.length} 项</summary>
        <p className="nutrition-small-note">
          核对餐食后勾选“同时加入我的食物库”。同名条目可更新；不同做法请用不同名称。保存于本机，随个人页备份导出。
        </p>
        <input
          aria-label="搜索我的食物库"
          placeholder="搜索名称或别名"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!items.length && <p>这里等着收好你确认过的食物。</p>}
        {items
          .filter((x) =>
            [x.name, ...x.aliases].some((n) =>
              n.toLowerCase().includes(query.trim().toLowerCase()),
            ),
          )
          .map((food) => (
            <article key={food.id}>
              <strong>{food.name}</strong>
              <p>
                {food.per100.kcal} kcal / 100g ·{" "}
                {food.gramsPerFist === null
                  ? "未设置拳重"
                  : `1拳约${food.gramsPerFist}g`}
              </p>
              <small>{food.note}</small>
              <div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => edit(food)}
                  aria-label={`编辑食物 ${food.name}`}
                >
                  修改
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(food)}
                  aria-label={`删除食物 ${food.name}`}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
      </details>
      {error && !editing && (
        <p role="alert" className="nutrition-error">
          {error}
        </p>
      )}
      <Modal
        open={!!editing}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        title="修改我的食物"
      >
        {editing && (
          <form onSubmit={save}>
            <label>
              食物名称
              <input
                aria-label="我的食物名称"
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              别名（顿号分隔）
              <input
                aria-label="我的食物别名"
                value={aliases}
                maxLength={1000}
                onChange={(e) => setAliases(e.target.value)}
              />
            </label>
            <label>
              默认份量（克）
              <input
                aria-label="我的食物默认份量"
                required
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={editing.defaultGrams}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    defaultGrams: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              一拳约重（克，选填）
              <input
                aria-label="我的食物一拳克数"
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={fist}
                onChange={(e) => setFist(e.target.value)}
              />
            </label>
            <div className="per100-grid">
              {nutrients.map((n) => (
                <label key={n.key}>
                  {n.name} / 100g
                  <input
                    aria-label={`我的食物每100克${n.name}`}
                    type="number"
                    min="0"
                    max={n.key === "kcal" ? 1000 : 100}
                    step="0.01"
                    required
                    value={editing.per100[n.key]}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        per100: {
                          ...editing.per100,
                          [n.key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              做法与用油说明
              <textarea
                aria-label="我的食物做法说明"
                maxLength={500}
                value={editing.note}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className="nutrition-error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              保存食物修改
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}
