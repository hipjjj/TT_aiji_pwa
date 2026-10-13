import { db } from "../db";
import type { ChatMode, ChatThread } from "./types";
import { penguins } from "./model.mjs";
export const draftKey = (thread: ChatThread | null, mode: ChatMode) =>
  thread ? "thread:" + thread.id : "new:" + mode;
export async function restoreChat(initialMode: ChatMode) {
  const threads = await db.chatThreads.orderBy("updatedAt").reverse().toArray();
  const meta = await db.appMeta.get("chat-session");
  let saved: { mode: ChatMode; threadId: string | null } | null = null;
  try {
    const x = JSON.parse(String(meta?.value || "null"));
    if (
      x &&
      ["群聊", ...penguins].includes(x.mode) &&
      (x.threadId === null || typeof x.threadId === "string")
    )
      saved = x;
  } catch {
    /* Invalid UI state does not affect saved messages. */
  }
  const thread = saved?.threadId
    ? threads.find((t) => t.id === saved.threadId) || threads[0] || null
    : saved
      ? null
      : threads[0] || null;
  const mode = thread?.mode || saved?.mode || initialMode;
  const draft = await db.chatDrafts.get(draftKey(thread, mode));
  const messages = thread
    ? (
        await db.chatMessages.where("threadId").equals(thread.id).toArray()
      ).sort((a, b) => a.createdAt - b.createdAt)
    : [];
  return { threads, thread, mode, text: draft?.text || "", messages };
}
export async function rememberSelection(
  thread: ChatThread | null,
  mode: ChatMode,
) {
  await db.appMeta.put({
    id: "chat-session",
    value: JSON.stringify({ mode, threadId: thread?.id || null }),
    updatedAt: Date.now(),
  });
}
