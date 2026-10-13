import React, { useEffect, useState } from "react";
import { db } from "../db";
import type { ChatMemory, ChatGrowth } from "./types";
export default function MemoryPanel() {
  const [memories, setMemories] = useState<ChatMemory[]>([]),
    [growth, setGrowth] = useState<ChatGrowth>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [text, setText] = useState(""),
    [kind, setKind] = useState<ChatMemory["kind"]>("偏好");
  const load = async () => {
    const [m, g] = await Promise.all([
      db.chatMemories.toArray(),
      db.chatGrowth.get("main"),
    ]);
    setMemories(m.sort((a, b) => b.updatedAt - a.updatedAt));
    setGrowth(g);
  };
  useEffect(() => {
    load().catch(() => setError("暂时打不开记忆"));
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="personal-ai chat-memory">
      <span className="park-label">OUR LITTLE MEMORIES</span>
      <h2>企鹅小家的记忆</h2>
      <p>
        只有你确认过的事情才会收在这里。删除聊天不会删除这些记忆；删除记忆后，原聊天文字仍保留，可另行删除对话。
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setEditing("new");
          setText("");
          setKind("偏好");
        }}
      >
        ＋ 添加记忆
      </button>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!text.trim()) throw Error("请填写记忆");
              await db.chatMemories.put({
                id: editing === "new" ? crypto.randomUUID() : editing,
                kind,
                text: text.trim(),
                updatedAt: Date.now(),
              });
              setEditing(null);
            });
          }}
        >
          <label>
            类别
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ChatMemory["kind"])}
            >
              {["偏好", "真实经历", "家庭小剧场"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            记忆内容
            <textarea
              aria-label="记忆内容"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button disabled={busy}>确认保存记忆</button>
          <button type="button" onClick={() => setEditing(null)}>
            取消
          </button>
        </form>
      )}
      {memories.map((m) => (
        <article key={m.id}>
          <small>{m.kind}</small>
          <p>{m.text}</p>
          <button
            disabled={busy}
            onClick={() => {
              setEditing(m.id);
              setText(m.text);
              setKind(m.kind);
            }}
          >
            修改
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (confirm("删除这条长期记忆？"))
                void run(() => db.chatMemories.delete(m.id));
            }}
          >
            删除
          </button>
        </article>
      ))}
      {!memories.length && <p>小家的记忆抽屉还空着，慢慢一起装满吧。</p>}
      <details>
        <summary>黏黏包的成长 · {growth?.value || 0}/100</summary>
        <p>
          成长由你确认的互动逐步积累：每次增加1，至少间隔一天，每7天最多2次。核心性格始终乖巧温和。
        </p>
        <label>
          调整成长程度
          <input
            aria-label="调整成长程度"
            type="number"
            min="0"
            max="100"
            defaultValue={growth?.value || 0}
            key={growth?.updatedAt}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (
                Number.isInteger(value) &&
                value >= 0 &&
                value <= 100 &&
                value !== (growth?.value || 0) &&
                confirm(`确认将黏黏包成长程度调整为 ${value}？`)
              )
                void run(() =>
                  db.chatGrowth.put({
                    id: "main",
                    value,
                    events: growth?.events || [],
                    updatedAt: Date.now(),
                  }),
                );
            }}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            if (confirm("重置黏黏包成长程度并删除成长依据？"))
              void run(() => db.chatGrowth.delete("main"));
          }}
        >
          重置成长
        </button>
        {growth?.events.map((e, i) => (
          <p key={i}>
            <small>{new Date(e.at).toLocaleDateString()}</small> {e.text}
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("删除这条成长依据，并减少一级成长？"))
                  void run(() =>
                    db.chatGrowth.put({
                      ...growth,
                      value: Math.max(0, growth.value - 1),
                      events: growth.events.filter((_, j) => j !== i),
                      updatedAt: Date.now(),
                    }),
                  );
              }}
            >
              删除依据
            </button>
          </p>
        ))}
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
