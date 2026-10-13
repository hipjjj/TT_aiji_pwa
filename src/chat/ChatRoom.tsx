import React, { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { Modal } from "../nutrition/NutritionTab";
import { penguins, validateChatRequest, validateChatResult } from "./model.mjs";
import { resolveProposal } from "./store";
import type { ChatThread, ChatMessage, ChatMode, Proposal } from "./types";
import { categories } from "../model.mjs";
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
}: {
  proposal: Proposal;
  messageId: string;
  onChange: () => Promise<void>;
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
            maxLength={500}
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
        {["食材", "购物"].includes(p.kind) && (
          <>
            <label>
              名称
              <input
                maxLength={100}
                value={p.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            <div className="chat-card-row">
              <label>
                数量
                <input
                  maxLength={30}
                  value={p.quantity}
                  onChange={(e) => field("quantity", e.target.value)}
                />
              </label>
              <label>
                单位
                <input
                  maxLength={20}
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
}: {
  initialMode: ChatMode;
  onClose: () => void;
  onManageAI: () => void;
  onRecordsChanged: () => Promise<void>;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]),
    [thread, setThread] = useState<ChatThread | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [mode, setMode] = useState<ChatMode>(initialMode),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false),
    [history, setHistory] = useState(false),
    [ready, setReady] = useState(false);
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
  useEffect(() => {
    alive.current = true;
    loadThreads()
      .then(() => setReady(true))
      .catch(() => setError("暂时无法读取聊天记录"));
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);
  const close = () => {
    request.current?.abort();
    onClose();
  };
  const choose = async (t: ChatThread) => {
    setError("");
    setText("");
    setThread(t);
    setMode(t.mode);
    setHistory(false);
    try {
      await loadMessages(t.id);
    } catch {
      setError("无法打开这段聊天");
    }
  };
  const fresh = (m: ChatMode) => {
    setMode(m);
    setThread(null);
    setMessages([]);
    setText("");
    setError("");
    setHistory(false);
  };
  const send = async (retry = false) => {
    if (busy || !ready) return;
    const input = retry ? messages.at(-1)?.text : text.trim();
    if (!input || !consent) return;
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
        setText("");
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
      let recent = context.slice(-32).map(({ speaker, text, proposals }) => {
        if (!proposals.length) return { speaker, text };
        const receipts = proposals.map((p) =>
          `${p.kind}：${p.status === "accepted" ? "用户已确认并保存" : p.status === "dismissed" ? "用户已取消" : "尚未确认"}；${p.kind === "账单" ? `${p.date} ${p.category} ¥${p.cents / 100}` : ["食材", "购物"].includes(p.kind) ? `${p.name} ${p.quantity}${p.unit} ${p.location}` : p.text}`.slice(
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
      });
      while (JSON.stringify(recent).length > 14000 && recent.length > 1)
        recent = recent.slice(1);
      const payload = validateChatRequest({
        mode: active.mode,
        messages: recent,
        memories,
        growth: growth?.value || 0,
        today: today(),
      });
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
        <button disabled={busy} onClick={() => setHistory(!history)}>
          聊天记录
        </button>
        <button disabled={busy} onClick={() => fresh(mode)}>
          ＋ 新聊天
        </button>
      </div>
      <div className="chat-modes" aria-label="聊天模式">
        {(["群聊", ...penguins] as ChatMode[]).map((m) => (
          <button
            disabled={busy}
            key={m}
            aria-pressed={mode === m}
            onClick={() => {
              if (m !== mode) fresh(m);
            }}
          >
            {m === "群聊" ? "企鹅家族" : m}
          </button>
        ))}
      </div>
      {history ? (
        <section className="chat-history">
          <h3>小家的聊天记录</h3>
          {!threads.length && <p>还没有聊天，来坐一会儿吧。</p>}
          {threads.map((t) => (
            <article key={t.id}>
              <button onClick={() => void choose(t)}>
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
                      [db.chatThreads, db.chatMessages],
                      async () => {
                        await db.chatMessages
                          .where("threadId")
                          .equals(t.id)
                          .delete();
                        await db.chatThreads.delete(t.id);
                      },
                    );
                    if (thread?.id === t.id) fresh(mode);
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
                  {penguins.map((n) => (
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
                  <p className="chat-bubble">{m.text}</p>
                  {m.proposals.map((p) => (
                    <Card
                      key={p.id}
                      proposal={p}
                      messageId={m.id}
                      onChange={changed}
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
            <label className="chat-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={busy}
              />
              允许将本次文字、近期对话和相关已确认记忆发给 OpenAI
            </label>
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
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <button disabled={busy || !ready || !consent || !text.trim()}>
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
      {error && (
        <div className="chat-error" role="alert">
          <p>{error}</p>
          {messages.at(-1)?.speaker === "用户" && (
            <button disabled={busy || !consent} onClick={() => void send(true)}>
              重试这条消息
            </button>
          )}
          <button
            disabled={busy}
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
