import { categories, validDate } from "../model.mjs";
export const penguins = ["鲍比", "小包", "嘟嘟糕", "黏黏包"];
const str = (x, max, empty = false) => {
  if (typeof x !== "string" || x.length > max || (!empty && !x.trim()))
    throw Error("聊天内容格式无效");
  return x.trim();
};
const arr = (x, max) => {
  if (!Array.isArray(x) || x.length > max)
    throw Error("聊天数据过多或格式无效");
  return x;
};
const num = (x, max) => {
  if (!Number.isSafeInteger(x) || x < 0 || x > max) throw Error("聊天数值无效");
  return x;
};
export function validateChatRequest(x) {
  if (!x || !["群聊", ...penguins].includes(x.mode))
    throw Error("聊天模式无效");
  const messages = arr(x.messages, 32).map((m) => {
    if (!["用户", ...penguins].includes(m.speaker)) throw Error("角色无效");
    return { speaker: m.speaker, text: str(m.text, 2000) };
  });
  if (!messages.length || messages.at(-1).speaker !== "用户")
    throw Error("缺少用户消息");
  const memories = arr(x.memories || [], 20).map((m) => {
    if (!["偏好", "真实经历", "家庭小剧场"].includes(m.kind))
      throw Error("记忆类别无效");
    return { kind: m.kind, text: str(m.text, 500) };
  });
  const growth = num(x.growth ?? 0, 100);
  const today = str(x.today, 10);
  if (!validDate(today)) throw Error("日期无效");
  const value = { mode: x.mode, messages, memories, growth, today };
  if (JSON.stringify(value).length > 26000) throw Error("聊天上下文太长");
  return value;
}
export function validateProposal(p) {
  const kind = str(p.kind, 30),
    text = str(p.text, 500),
    name = str(p.name ?? "", 100, true),
    unit = str(p.unit ?? "", 20, true),
    quantity = str(p.quantity ?? "", 30, true),
    category = str(p.category ?? "", 20, true),
    date = str(p.date ?? "", 10, true),
    location = str(p.location ?? "", 10, true),
    memoryKind = str(p.memoryKind ?? "", 20, true),
    cents = num(p.cents ?? 0, 100000000);
  if (!["记忆", "成长", "账单", "食材", "购物"].includes(kind))
    throw Error("不支持的操作");
  if (
    kind === "记忆" &&
    !["偏好", "真实经历", "家庭小剧场"].includes(memoryKind)
  )
    throw Error("记忆类别无效");
  if (kind === "成长" && (!text || memoryKind !== "家庭小剧场"))
    throw Error("成长需要具体互动依据");
  if (
    kind === "账单" &&
    (!validDate(date) || !categories.includes(category) || cents <= 0)
  )
    throw Error("请检查账单日期、分类和金额");
  if (["食材", "购物"].includes(kind) && (!name || !quantity || !unit))
    throw Error("请补全食材名称、数量和单位");
  if (kind === "食材" && !["冷藏", "冷冻", "常温"].includes(location))
    throw Error("储存位置无效");
  return {
    kind,
    text,
    name,
    unit,
    quantity,
    category,
    date,
    location,
    memoryKind,
    cents,
  };
}
export function validateChatResult(x, mode = "群聊", lastText = "") {
  const replies = arr(x?.replies, 4).map((r) => {
    if (
      !penguins.includes(r.speaker) ||
      (mode !== "群聊" && r.speaker !== mode)
    )
      throw Error("回复角色无效");
    return { speaker: r.speaker, text: str(r.text, 2000) };
  });
  if (!replies.length) throw Error("企鹅暂时没有回应");
  const named = penguins.filter((n) => lastText.includes("@" + n));
  if (
    mode === "群聊" &&
    named.length &&
    replies.some((r) => !named.includes(r.speaker))
  )
    throw Error("点名回复角色无效");
  if (new Set(replies.map((r) => r.speaker)).size !== replies.length)
    throw Error("角色重复");
  if (
    replies.length > 1 &&
    new Set(replies.map((r) => r.text)).size !== replies.length
  )
    throw Error("企鹅不能重复相同对白");
  const proposals = arr(x.proposals || [], 3).map(validateProposal);
  if (proposals.filter((p) => p.kind === "成长").length > 1)
    throw Error("成长提议重复");
  return { replies, proposals };
}
export function grow(current, now = Date.now()) {
  const old = current || { id: "main", value: 0, events: [], updatedAt: 0 };
  const recent = old.events.filter((e) => now - e.at < 7 * 86400000);
  if (recent.length >= 2 || old.events.some((e) => now - e.at < 86400000))
    throw Error("黏黏包会慢慢成长，这次先把互动收好，过些日子再成长吧");
  return {
    id: "main",
    value: Math.min(100, old.value + 1),
    events: old.events,
    updatedAt: now,
  };
}
export function validateChatBackup(data) {
  if (data.chat === undefined) return null;
  const x = data.chat;
  if (!x || typeof x !== "object") throw Error("聊天备份无效");
  const ids = new Set();
  const id = (v) => {
    const s = str(v, 100);
    if (ids.has(s)) throw Error("聊天编号重复");
    ids.add(s);
    return s;
  };
  const threads = arr(x.threads, 1000).map((t) => {
    if (!["群聊", ...penguins].includes(t.mode)) throw Error("聊天模式无效");
    return {
      id: id(t.id),
      mode: t.mode,
      title: str(t.title, 100),
      updatedAt: num(t.updatedAt, 9e15),
    };
  });
  const known = new Set(threads.map((t) => t.id));
  const messages = arr(x.messages, 100000).map((m) => {
    if (!known.has(m.threadId) || !["用户", ...penguins].includes(m.speaker))
      throw Error("聊天记录关联无效");
    const proposals = arr(m.proposals || [], 3).map((p) => {
      if (!["pending", "accepted", "dismissed"].includes(p.status))
        throw Error("确认状态无效");
      return { ...validateProposal(p), id: id(p.id), status: p.status };
    });
    return {
      id: id(m.id),
      threadId: m.threadId,
      speaker: m.speaker,
      text: str(m.text, 2000),
      createdAt: num(m.createdAt, 9e15),
      proposals,
    };
  });
  const memories = arr(x.memories, 10000).map((m) => {
    if (!["偏好", "真实经历", "家庭小剧场"].includes(m.kind))
      throw Error("记忆类别无效");
    return {
      id: id(m.id),
      kind: m.kind,
      text: str(m.text, 500),
      updatedAt: num(m.updatedAt, 9e15),
    };
  });
  let growth = null;
  if (x.growth) {
    growth = {
      id: "main",
      value: num(x.growth.value, 100),
      updatedAt: num(x.growth.updatedAt, 9e15),
      events: arr(x.growth.events, 10000).map((e) => ({
        at: num(e.at, 9e15),
        text: str(e.text, 500),
      })),
    };
  }
  return { threads, messages, memories, growth };
}
