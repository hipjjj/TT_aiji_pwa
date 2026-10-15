import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChatRequest, validateChatBackup } from "../src/chat/model.mjs";
import { handle } from "../server/worker.mjs";
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=";
const body = {
  mode: "鲍比",
  messages: [{ speaker: "用户", text: "看看这张照片" }],
  today: "2026-10-15",
  photo,
};
test("chat image is validated separately from bounded text; external and forged images are rejected", () => {
  assert.equal(validateChatRequest(body).photo, photo);
  for (const bad of [
    "https://example.com/a.jpg",
    "data:image/svg+xml;base64,AAAA",
    "data:image/png;base64,YWJj",
    "a".repeat(650001),
  ])
    assert.throws(() => validateChatRequest({ ...body, photo: bad }));
  assert.throws(() =>
    validateChatRequest({
      ...body,
      messages: [{ speaker: "用户", text: "a".repeat(2001) }],
    }),
  );
});
test("chat images survive backups, old text-only backups still validate and assistant images are refused", () => {
  const base = {
    version: 1,
    expenses: [],
    chat: {
      threads: [{ id: "t", mode: "鲍比", title: "看图", updatedAt: 1 }],
      messages: [
        {
          id: "m",
          threadId: "t",
          speaker: "用户",
          text: "看看",
          photo,
          createdAt: 1,
          proposals: [],
        },
      ],
      memories: [],
      growth: null,
    },
  };
  assert.equal(validateChatBackup(base).messages[0].photo, photo);
  const old = structuredClone(base);
  delete old.chat.messages[0].photo;
  assert.equal(validateChatBackup(old).messages[0].photo, undefined);
  const invalid = structuredClone(base);
  invalid.chat.messages[0].speaker = "鲍比";
  assert.throws(() => validateChatBackup(invalid));
});
test("chat forwards image as vision input without embedding base64 in text and rejects invalid upload before quota", async () => {
  let calls = 0,
    quotaCalls = 0;
  const env = {
    NUTRITION_API_KEY: "fixture-key",
    ACCESS_CODE: "fixture-access-code",
    ALLOWED_ORIGINS: "https://hipjjj.github.io",
    AI_QUOTA: {
      idFromName: () => 1,
      get: () => ({
        fetch: async () => {
          quotaCalls++;
          return Response.json({ allowed: true });
        },
      }),
    },
  };
  const make = (b) =>
    new Request("https://worker.test/chat", {
      method: "POST",
      headers: {
        Origin: "https://hipjjj.github.io",
        "Content-Type": "application/json",
        "X-Access-Code": "fixture-access-code",
      },
      body: JSON.stringify(b),
    });
  const fetchImpl = async (_, options) => {
    calls++;
    const data = JSON.parse(options.body);
    assert.equal(data.store, false);
    assert.equal(data.input[0].content[1].type, "input_image");
    assert.equal(data.input[0].content[1].image_url, photo);
    assert(!data.input[0].content[0].text.includes("base64"));
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                replies: [
                  { speaker: "鲍比", text: "我看见啦，我们一起看看。" },
                ],
                proposals: [],
              }),
            },
          ],
        },
      ],
    });
  };
  assert.equal(
    (
      await handle(make({ ...body, photo: "https://bad.test" }), env, {
        fetchImpl,
      })
    ).status,
    400,
  );
  assert.equal(quotaCalls, 0);
  assert.equal((await handle(make(body), env, { fetchImpl })).status, 200);
  assert.equal(calls, 1);
  assert.equal(quotaCalls, 1);
});
