import { preparePhoto } from "../nutrition/photo";
import { recordLimits } from "../recordLimits.mjs";
import { restoreChat, rememberSelection, draftKey } from "./session";
import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { Modal } from "../nutrition/NutritionTab";
import {
  penguins,
  validateChatRequest,
  validateChatResult,
  honestOperationReply,
} from "./model.mjs";
import { resolveProposal } from "./store";
import type { ChatThread, ChatMessage, ChatMode, Proposal } from "./types";
import { categories } from "../model.mjs";
import { sumNutrition, standardizeAIFoods } from "../nutrition/model.mjs";
import bobby from "../assets/penguin-park.webp";
import bao from "../assets/xiaobao-nutrition.webp";
import dudu from "../assets/dudu-fridge.webp";
import niannian from "../assets/niannian-travel.webp";
import "./style.css";
const portraits: Record<string, string> = {
  鲍比: bobby,
  小包: bao,
  嘟嘟糕: dudu,
  黏黏包: niannian,
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function Card({
  proposal,
  messageId,
  onChange,
  onViewExpense,
  onViewRecord,
}: {
  proposal: Proposal;
  messageId: string;
  onChange: () => Promise<void>;
  onViewExpense: (date: string) => void;
  onViewRecord: (kind: "饮食" | "食材" | "购物", date: string) => void;
}) {
  const [p, setP] = useState(proposal),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const field = (k: keyof Proposal, value: string | number) =>
    setP({ ...p, [k]: value });
  const resolve = async (accept: boolean) => {
    setBusy(true);
    setError("");
    try {
      await resolveProposal(messageId, proposal.id, accept, p);
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  if (proposal.status !== "pending")
    return (
      <div className="chat-card done">
        {proposal.kind} ·{" "}
        {proposal.status === "accepted" ? "已确认保存" : "已取消"}
        {proposal.status === "accepted" && proposal.kind === "账单" && (
          <>
            <p>
              {proposal.date} · {proposal.category} · ¥
              {(proposal.cents / 100).toFixed(2)}
              {proposal.text ? ` · ${proposal.text}` : ""}
            </p>
            <button onClick={() => onViewExpense(proposal.date)}>
              查看账单
            </button>
          </>
        )}
        {proposal.status === "accepted" &&
          ["食材", "购物"].includes(proposal.kind) && (
            <>
              <p>
                {proposal.name} · {proposal.quantity}
                {proposal.unit} {proposal.location}
              </p>
              <button
                onClick={() =>
                  onViewRecord(proposal.kind as "食材" | "购物", proposal.date)
                }
              >
                {proposal.kind === "食材" ? "查看冰箱" : "查看购物清单"}
              </button>
            </>
          )}
        {proposal.status === "accepted" && proposal.kind === "饮食" && (
          <>
            <p>
              {proposal.date} · {proposal.mealType} ·{" "}
              {proposal.foods?.map((f) => f.name).join("、")}
            </p>
            <p>
              热量 {sumNutrition(proposal.foods || []).kcal} kcal · 蛋白质{" "}
              {sumNutrition(proposal.foods || []).protein} g · 碳水{" "}
              {sumNutrition(proposal.foods || []).carbs} g · 脂肪{" "}
              {sumNutrition(proposal.foods || []).fat} g
            </p>
            <button onClick={() => onViewRecord("饮食", proposal.date)}>
              查看饮食
            </button>
          </>
        )}
      </div>
    );
  return (
    <section className="chat-card">
      <strong>
        {p.kind === "成长"
          ? "黏黏包要把这次成长收好吗？"
          : p.kind === "记忆"
            ? "这件事要帮你记住吗？"
            : `帮你添加${p.kind}？`}
      </strong>
      <fieldset disabled={busy}>
        {p.kind === "记忆" && (
          <label>
            记忆类别
            <select
              value={p.memoryKind}
              onChange={(e) => field("memoryKind", e.target.value)}
            >
              {["偏好", "真实经历", "家庭小剧场"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          {["记忆", "成长"].includes(p.kind) ? "内容／依据" : "备注"}
          <textarea
            maxLength={recordLimits.note}
            value={p.text}
            onChange={(e) => field("text", e.target.value)}
          />
        </label>
        {p.kind === "账单" && (
          <>
            <label>
              金额（元）
              <input
                aria-label="待确认账单金额"
                type="number"
                min="0.01"
                step="0.01"
                value={p.cents / 100}
                onChange={(e) =>
                  field("cents", Math.round(Number(e.target.value) * 100))
                }
              />
            </label>
            <label>
              分类
              <select
                value={p.category}
                onChange={(e) => field("category", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              日期
              <input
                type="date"
                value={p.date}
                onChange={(e) => field("date", e.target.value)}
              />
            </label>
          </>
        )}
        {p.kind === "饮食" && (
          <>
            <label>
              饮食日期
              <input
                aria-label="待确认饮食日期"
                type="date"
                value={p.date}
                onChange={(e) => field("date", e.target.value)}
              />
            </label>
            <label>
              餐次
              <select
                aria-label="待确认餐次"
                value={p.mealType}
                onChange={(e) => field("mealType", e.target.value)}
              >
                {["早餐", "午餐", "晚餐", "加餐"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {(p.foods || []).map((food, i) => (
              <details key={i} open className="chat-food">
                <summary>
                  {food.name} · {food.grams} g
                </summary>
                <label>
                  食物名称
                  <input
                    value={food.name}
                    maxLength={recordLimits.name}
                    onChange={(e) =>
                      setP({
                        ...p,
                        foods: p.foods!.map((f, j) =>
                          j === i ? { ...f, name: e.target.value } : f,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  可食用重量（克）
                  <input
                    aria-label={`食物${i + 1}重量`}
                    type="number"
                    min="0.01"
                    max="10000"
                    step="any"
                    value={food.grams}
                    onChange={(e) =>
                      setP({
                        ...p,
                        foods: p.foods!.map((f, j) =>
                          j === i ? { ...f, grams: Number(e.target.value) } : f,
                        ),
                      })
                    }
                  />
                </label>
                <p>{food.assumption} · AI估算，确认前可修改</p>
                <details>
                  <summary>修改每100克营养</summary>
                  {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
                    <label key={k}>
                      {
                        {
                          kcal: "热量（kcal）",
                          protein: "蛋白质（g）",
                          carbs: "碳水（g）",
                          fat: "脂肪（g）",
                        }[k]
                      }
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={food.per100[k]}
                        onChange={(e) =>
                          setP({
                            ...p,
                            foods: p.foods!.map((f, j) =>
                              j === i
                                ? {
                                    ...f,
                                    per100: {
                                      ...f.per100,
                                      [k]: Number(e.target.value),
                                    },
                                    assumption:
                                      f.assumption
                                        .replace(/；营养数值由用户调整。$/, "")
                                        .slice(0, 950) +
                                      "；营养数值由用户调整。",
                                  }
                                : f,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </details>
              </details>
            ))}
            <p className="chat-meal-totals" aria-live="polite">
              本餐估算：{sumNutrition(p.foods || []).kcal} kcal · 蛋白质{" "}
              {sumNutrition(p.foods || []).protein} g · 碳水{" "}
              {sumNutrition(p.foods || []).carbs} g · 脂肪{" "}
              {sumNutrition(p.foods || []).fat} g
            </p>
          </>
        )}
        {["食材", "购物"].includes(p.kind) && (
          <>
            <label>
              名称
              <input
                maxLength={recordLimits.name}
                value={p.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            <div className="chat-card-row">
              <label>
                数量
                <input
                  maxLength={recordLimits.quantity}
                  value={p.quantity}
                  onChange={(e) => field("quantity", e.target.value)}
                />
              </label>
              <label>
                单位
                <input
                  maxLength={recordLimits.unit}
                  value={p.unit}
                  onChange={(e) => field("unit", e.target.value)}
                />
              </label>
            </div>
            {p.kind === "食材" && (
              <label>
                存放位置
                <select
                  value={p.location}
                  onChange={(e) => field("location", e.target.value)}
                >
                  {["冷藏", "冷冻", "常温"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        <button onClick={() => void resolve(true)}>确认保存</button>
        <button onClick={() => void resolve(false)}>取消</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export default function ChatRoom({
  initialMode,
  onClose,
  onManageAI,
  onRecordsChanged,
  onViewExpense,
  onViewRecord,
}: {
  initialMode: ChatMode;
  onClose: () => void;
  onManageAI: () => void;
  onRecordsChanged: () => Promise<void>;
  onViewExpense: (date: string) => void;
  onViewRecord: (kind: "饮食" | "食材" | "购物", date: string) => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]),
    [thread, setThread] = useState<ChatThread | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [mode, setMode] = useState<ChatMode>(initialMode),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [unsent, setUnsent] = useState<{ mode: ChatMode; text: string }[]>([]),
    [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null),
    [photoBusy, setPhotoBusy] = useState(false),
    [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null),
    photoEpoch = useRef(0);
  const clearPhoto = () => {
    photoEpoch.current++;
    setPhoto(null);
    setPhotoBusy(false);
  };
  const loadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const epoch = photoEpoch.current;
    setPhotoBusy(true);
    try {
      const value = await preparePhoto(file);
      if (alive.current && epoch === photoEpoch.current) {
        setPhoto(value);
        setError("");
      }
    } catch (e) {
      if (alive.current && epoch === photoEpoch.current)
        setError(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      if (alive.current && epoch === photoEpoch.current) setPhotoBusy(false);
    }
  };
  const request = useRef<AbortController | null>(null),
    alive = useRef(true),
    bottom = useRef<HTMLDivElement>(null);
  const loadThreads = async () =>
    setThreads(await db.chatThreads.orderBy("updatedAt").reverse().toArray());
  const loadMessages = async (id: string) =>
    setMessages(
      (await db.chatMessages.where("threadId").equals(id).toArray()).sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    );
  const draftRef = useRef<{
      id: string;
      text: string;
      mode: ChatMode;
      updatedAt: number;
    } | null>(null),
    draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushDraft = async () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const d = draftRef.current;
    if (d) {
      if (d.text) await db.chatDrafts.put(d);
      else await db.chatDrafts.delete(d.id);
      await db.appMeta.put({
        id: "chat-session",
        value: JSON.stringify({
          mode: d.mode,
          threadId: d.id.startsWith("thread:") ? d.id.slice(7) : null,
        }),
        updatedAt: Date.now(),
      });
    }
  };
  const changeText = (value: string) => {
    setText(value);
    draftRef.current = {
      id: draftKey(thread, mode),
      text: value,
      mode,
      updatedAt: Date.now(),
    };
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void flushDraft().catch(() =>
        setError("草稿保存失败，文字仍在输入框，请检查本地空间"),
      );
    }, 250);
  };
  useEffect(() => {
    alive.current = true;
    restoreChat(initialMode)
      .then((state) => {
        if (!alive.current) return;
        setThreads(state.threads);
        setThread(state.thread);
        setMode(state.mode);
        setText(state.text);
        setMessages(state.messages);
        draftRef.current = {
          id: draftKey(state.thread, state.mode),
          text: state.text,
          mode: state.mode,
          updatedAt: Date.now(),
        };
        if (state.messages.at(-1)?.speaker === "用户")
          setError("上次聊天还没有收到回应，可重试这条消息。");
        setReady(true);
      })
      .catch(() => setError("暂时无法读取聊天记录"));
    return () => {
      alive.current = false;
      request.current?.abort();
      void flushDraft().catch(() => {});
    };
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  const close = () => {
    request.current?.abort();
    void flushDraft().catch(() => {});
    onClose();
  };
  const choose = async (t: ChatThread) => {
    setReady(false);
    setError("");
    try {
      await flushDraft();
      const draft = await db.chatDrafts.get(draftKey(t, t.mode));
      clearPhoto();
      setThread(t);
      setMode(t.mode);
      setText(draft?.text || "");
      draftRef.current = {
        id: draftKey(t, t.mode),
        text: draft?.text || "",
        mode: t.mode,
        updatedAt: Date.now(),
      };
      setHistory(false);
      await loadMessages(t.id);
      await rememberSelection(t, t.mode);
    } catch {
      setError("无法打开这段聊天");
    } finally {
      setReady(true);
    }
  };
  const fresh = async (m: ChatMode) => {
    setReady(false);
    setError("");
    try {
      await flushDraft();
      const pending = await db.chatDrafts.get(draftKey(null, m));
      if (
        pending?.text &&
        !confirm("开始新聊天会清空这份未发送的新对话草稿，确认继续？")
      )
        return;
      await db.chatDrafts.delete(draftKey(null, m));
      clearPhoto();
      setMode(m);
      setThread(null);
      setMessages([]);
      setText("");
      draftRef.current = {
        id: draftKey(null, m),
        text: "",
        mode: m,
        updatedAt: Date.now(),
      };
      setHistory(false);
      await rememberSelection(null, m);
    } catch {
      setError("新聊天暂时打不开");
    } finally {
      setReady(true);
    }
  };
  const switchMode = async (m: ChatMode, preferDraft = false) => {
    setReady(false);
    try {
      const t = (
        await db.chatThreads.orderBy("updatedAt").reverse().toArray()
      ).find((t) => t.mode === m);
      const draft = await db.chatDrafts.get(draftKey(null, m));
      if (
        t &&
        !(draft?.text && (preferDraft || draft.updatedAt >= t.updatedAt))
      )
        await choose(t);
      else {
        await flushDraft();
        const draft = await db.chatDrafts.get(draftKey(null, m));
        clearPhoto();
        setMode(m);
        setThread(null);
        setMessages([]);
        setText(draft?.text || "");
        draftRef.current = {
          id: draftKey(null, m),
          text: draft?.text || "",
          mode: m,
          updatedAt: Date.now(),
        };
        await rememberSelection(null, m);
        setError("");
        setHistory(false);
      }
    } finally {
      setReady(true);
    }
  };
  const send = async (retry = false) => {
    if (busy || photoBusy || !ready) return;
    const sentPhoto = retry ? messages.at(-1)?.photo : photo;
    const input = retry
      ? messages.at(-1)?.text
      : text.trim() || (sentPhoto ? "看看这张图片，想听听你怎么说。" : "");
    if (!input) return;
    setBusy(true);
    setError("");
    let active = thread;
    try {
      if (!navigator.onLine)
        throw Error("现在离线啦，可以翻看聊天记录，联网后再聊");
      const config = await db.settings.get("ai"),
        url = config
          ? config.url
          : import.meta.env.VITE_NUTRITION_API_URL || "",
        access = sessionStorage.getItem("xiaobao-ai-access") || "";
      if (!url || access.length < 16)
        throw Error("请先在个人页保存AI连接地址和访问口令");
      const endpoint = new URL(url);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.username ||
        endpoint.password ||
        endpoint.pathname !== "/" ||
        endpoint.search ||
        endpoint.hash
      )
        throw Error("AI地址格式无效，请到个人页重新设置");
      if (!active) {
        active = {
          id: crypto.randomUUID(),
          mode,
          title: input.slice(0, 40),
          updatedAt: Date.now(),
        };
        await db.chatThreads.add(active);
        setThread(active);
        await rememberSelection(active, active.mode);
      }
      const id = active.id;
      let context = messages;
      if (!retry) {
        const m: ChatMessage = {
          id: crypto.randomUUID(),
          threadId: id,
          speaker: "用户",
          text: input,
          createdAt: Date.now(),
          proposals: [],
          ...(sentPhoto ? { photo: sentPhoto } : {}),
        };
        await db.transaction(
          "rw",
          [db.chatMessages, db.chatThreads],
          async () => {
            await db.chatMessages.add(m);
            await db.chatThreads.update(id, { updatedAt: m.createdAt });
          },
        );
        context = [...messages, m];
        setMessages(context);
        await db.chatDrafts.delete(draftKey(thread, mode));
        setPhoto(null);
        setText("");
        draftRef.current = {
          id: draftKey(active, active.mode),
          text: "",
          mode: active.mode,
          updatedAt: Date.now(),
        };
        await rememberSelection(active, active.mode);
      }
      const [allMemories, growth] = await Promise.all([
        db.chatMemories.toArray(),
        db.chatGrowth.get("main"),
      ]);
      // Prefer memories sharing words with the current message, then recent confirmed memories.
      const words = input.match(/[\p{L}\p{N}]{2,}/gu) || [];
      const memories = allMemories
        .sort(
          (a, b) =>
            Number(words.some((w) => b.text.includes(w))) -
              Number(words.some((w) => a.text.includes(w))) ||
            b.updatedAt - a.updatedAt,
        )
        .slice(0, 20)
        .map(({ kind, text }) => ({ kind, text }));
      let recent = context
        .slice(-32)
        .map(
          (
            { speaker, text, proposals, photo: historicalPhoto },
            index,
            list,
          ) => {
            if (historicalPhoto && index !== list.length - 1)
              text = (text + "\n[曾附图片，本轮未上传]").slice(0, 2000);
            if (!proposals.length) return { speaker, text };
            const receipts = proposals.map((p) =>
              `${p.kind}：${p.status === "accepted" ? "用户已确认并保存" : p.status === "dismissed" ? "用户已取消" : "尚未确认"}；${p.kind === "账单" ? `${p.date} ${p.category} ¥${p.cents / 100}` : ["食材", "购物"].includes(p.kind) ? `${p.name} ${p.quantity}${p.unit} ${p.location}` : p.kind === "饮食" ? `${p.date} ${p.mealType} ${p.foods?.map((f) => f.name + " " + f.grams + "g").join("、")}` : p.text}`.slice(
                0,
                250,
              ),
            );
            return {
              speaker,
              text: (
                text.slice(0, 1200) +
                "\n[应用内卡片状态，仅说明操作结果，并非企鹅对白]\n" +
                receipts.join("\n")
              ).slice(0, 2000),
            };
          },
        );
      while (JSON.stringify(recent).length > 14000 && recent.length > 1)
        recent = recent.slice(1);
      const payload = validateChatRequest({
        mode: active.mode,
        photo: sentPhoto,
        messages: recent,
        memories,
        growth: growth?.value || 0,
        today: today(),
      });
      if (!alive.current) return;
      const controller = new AbortController();
      request.current = controller;
      const timer = setTimeout(() => controller.abort(), 45000);
      let result;
      try {
        const response = await fetch(endpoint.origin + "/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Access-Code": access,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "企鹅暂时没有接上话");
        result = validateChatResult(data, active.mode, input);
        result.proposals = result.proposals.map((p) =>
          p.kind === "饮食" ? { ...p, foods: standardizeAIFoods(p.foods) } : p,
        );
      } finally {
        clearTimeout(timer);
        request.current = null;
      }
      if (!alive.current) return;
      const base = Date.now(),
        replies: ChatMessage[] = result.replies.map(
          (
            r: { speaker: ChatMessage["speaker"]; text: string },
            i: number,
          ) => ({
            id: crypto.randomUUID(),
            threadId: id,
            ...r,
            createdAt: base + i,
            proposals:
              i === result.replies.length - 1
                ? result.proposals.map(
                    (p) =>
                      ({
                        ...p,
                        id: crypto.randomUUID(),
                        status: "pending",
                      }) as Proposal,
                  )
                : [],
          }),
        );
      await db.transaction(
        "rw",
        [db.chatMessages, db.chatThreads],
        async () => {
          await db.chatMessages.bulkAdd(replies);
          await db.chatThreads.update(id, { updatedAt: base + replies.length });
        },
      );
      await loadMessages(id);
      await loadThreads();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.name === "AbortError"
              ? "这次聊天等得有点久，请重试"
              : e.message
            : "聊天失败，请重试",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const changed = async () => {
    if (thread) await loadMessages(thread.id);
    await onRecordsChanged();
  };
  return (
    <Modal
      open
      onClose={close}
      title="企鹅小家"
      eyebrow="A LITTLE HOME, ALL OF US"
      className="chat-room"
    >
      <div className="chat-top">
        <button disabled={busy || !ready} onClick={() => setHistory(!history)}>
          聊天记录
        </button>
        <button disabled={busy || !ready} onClick={() => void fresh(mode)}>
          ＋ 新聊天
        </button>
      </div>
      <div className="chat-modes" aria-label="聊天模式">
        {(["群聊", ...penguins] as ChatMode[]).map((m) => (
          <button
            disabled={busy || !ready}
            key={m}
            aria-pressed={mode === m}
            onClick={() => {
              if (m !== mode)
                void switchMode(m).catch(() =>
                  setError("切换企鹅失败，请重试"),
                );
            }}
          >
            {m === "群聊" ? "企鹅家族" : m}
          </button>
        ))}
      </div>
      <p className="chat-operation-hint">
        记账等操作以卡片为准，点击“确认保存”后才会写入；企鹅对白不会自动保存。
      </p>
      {history ? (
        <section className="chat-history">
          <h3>小家的聊天记录</h3>
          {unsent.map((d) => (
            <article key={d.mode}>
              <button
                onClick={() =>
                  void switchMode(d.mode, true).catch(() =>
                    setError("草稿暂时打不开"),
                  )
                }
              >
                {d.mode} · 未发送草稿<small>{d.text.slice(0, 40)}</small>
              </button>
            </article>
          ))}
          {!threads.length && <p>还没有聊天，来坐一会儿吧。</p>}
          {threads.map((t) => (
            <article key={t.id}>
              <button disabled={busy || !ready} onClick={() => void choose(t)}>
                {t.mode} · {t.title}
                <small>{new Date(t.updatedAt).toLocaleDateString()}</small>
              </button>
              <button
                aria-label={`删除聊天 ${t.title}`}
                onClick={async () => {
                  if (
                    !confirm(
                      "删除这段聊天及未确认卡片？已保存的记忆和记录会保留。",
                    )
                  )
                    return;
                  try {
                    await db.transaction(
                      "rw",
                      [db.chatThreads, db.chatMessages, db.chatDrafts],
                      async () => {
                        await db.chatMessages
                          .where("threadId")
                          .equals(t.id)
                          .delete();
                        await db.chatThreads.delete(t.id);
                        await db.chatDrafts.delete("thread:" + t.id);
                      },
                    );
                    if (thread?.id === t.id) {
                      draftRef.current = null;
                      await switchMode(mode, true);
                    }
                    await loadThreads();
                  } catch {
                    setError("删除聊天失败");
                  }
                }}
              >
                删除
              </button>
            </article>
          ))}
        </section>
      ) : (
        <>
          <section
            className="chat-messages"
            aria-label="聊天消息"
            aria-busy={busy}
          >
            {!messages.length && (
              <div className="chat-welcome">
                <div className="chat-family">
                  {(mode === "群聊" ? penguins : [mode]).map((n) => (
                    <span
                      key={n}
                      className="chat-avatar"
                      role="img"
                      aria-label={n}
                      data-penguin={n}
                      style={{ backgroundImage: `url(${portraits[n]})` }}
                    />
                  ))}
                </div>
                <h3>
                  {mode === "群聊"
                    ? "大家都在，给你留了个位置。"
                    : `和${mode}坐一会儿`}
                </h3>
                <p>说说今天的小事吧。群聊中可以 @ 点名。</p>
                <small>对话保存在这台设备，长期记忆需要你确认。</small>
              </div>
            )}
            {messages.map((m) => (
              <article
                className={`chat-message ${m.speaker === "用户" ? "user" : ""}`}
                key={m.id}
              >
                {m.speaker !== "用户" && (
                  <span
                    className="chat-avatar"
                    aria-hidden="true"
                    data-penguin={m.speaker}
                    style={{ backgroundImage: `url(${portraits[m.speaker]})` }}
                  />
                )}
                <div>
                  <strong>{m.speaker === "用户" ? "你" : m.speaker}</strong>
                  <p className="chat-bubble">
                    {m.speaker === "用户"
                      ? m.text
                      : honestOperationReply(m.text, m.proposals)}
                  </p>
                  {m.photo && (
                    <button
                      type="button"
                      className="chat-photo-button"
                      aria-label="查看聊天图片"
                      onClick={() => setViewPhoto(m.photo!)}
                    >
                      <img
                        className="chat-photo"
                        src={m.photo}
                        alt="你发送的图片"
                        loading="lazy"
                      />
                    </button>
                  )}
                  {m.proposals.map((p) => (
                    <Card
                      key={p.id}
                      proposal={p}
                      messageId={m.id}
                      onChange={changed}
                      onViewExpense={onViewExpense}
                      onViewRecord={onViewRecord}
                    />
                  ))}
                </div>
              </article>
            ))}
            {busy && (
              <p className="chat-thinking" role="status">
                小家里传来了叽叽咕咕的声音…
              </p>
            )}
            <div ref={bottom} />
          </section>
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {photo && (
              <div className="chat-photo-preview">
                <img src={photo} alt="待发送的图片" />
                <button
                  type="button"
                  disabled={busy || photoBusy}
                  onClick={() => setPhoto(null)}
                >
                  移除图片
                </button>
              </div>
            )}
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="选择聊天图片"
              hidden
              onChange={(e) => void loadPhoto(e)}
            />
            <button
              className="chat-upload"
              type="button"
              disabled={busy || photoBusy || !ready}
              onClick={() => photoInput.current?.click()}
            >
              {photoBusy ? "正在压缩…" : "＋ 图片"}
            </button>
            <small className="chat-photo-help">
              每次1张，发送时交给AI查看；发送前会压缩，未发送图片切换聊天或关闭后不保留。
            </small>
            <div>
              <textarea
                aria-label="给企鹅们的话"
                placeholder={
                  mode === "群聊"
                    ? "今天想和大家说些什么？"
                    : "告诉" + mode + "…"
                }
                maxLength={2000}
                value={text}
                disabled={busy || !ready}
                onChange={(e) => changeText(e.target.value)}
              />
              <button
                disabled={
                  busy || photoBusy || !ready || (!text.trim() && !photo)
                }
              >
                发送
              </button>
            </div>
            {busy && (
              <button type="button" onClick={() => request.current?.abort()}>
                停止等待
              </button>
            )}
          </form>
        </>
      )}
      {viewPhoto && (
        <div
          className="chat-photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="聊天图片预览"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setViewPhoto(null);
            }
          }}
        >
          <button type="button" autoFocus onClick={() => setViewPhoto(null)}>
            关闭图片
          </button>
          <img src={viewPhoto} alt="聊天图片大图" />
        </div>
      )}
      {error && (
        <div className="chat-error" role="alert">
          <p>{error}</p>
          {messages.at(-1)?.speaker === "用户" && (
            <button
              disabled={busy || photoBusy}
              onClick={() => void send(true)}
            >
              重试这条消息
            </button>
          )}
          <button
            disabled={busy || photoBusy}
            onClick={() => {
              close();
              onManageAI();
            }}
          >
            打开AI连接设置
          </button>
        </div>
      )}
    </Modal>
  );
}
