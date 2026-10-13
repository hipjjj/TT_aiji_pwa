import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateChatRequest,
  validateChatResult,
  validateChatBackup,
  grow,
} from "../src/chat/model.mjs";
import { handle } from "../server/worker.mjs";
const body = {
  mode: "群聊",
  messages: [{ speaker: "用户", text: "@小包 今天开心吗？" }],
  memories: [{ kind: "偏好", text: "喜欢猫" }],
  growth: 0,
  today: "2026-10-13",
};
const p = {
  kind: "账单",
  text: "午饭",
  name: "",
  unit: "",
  quantity: "",
  category: "餐饮",
  date: "2026-10-13",
  location: "",
  memoryKind: "",
  cents: 3500,
};
test("chat sanitizes private fields and limits history and memory before provider", () => {
  const value = validateChatRequest({
    ...body,
    photos: ["secret"],
    expenses: [1],
    apiKey: "secret",
  });
  assert.deepEqual(Object.keys(value), [
    "mode",
    "messages",
    "memories",
    "growth",
    "today",
  ]);
  assert.throws(() =>
    validateChatRequest({
      ...body,
      messages: Array(33).fill(body.messages[0]),
    }),
  );
  assert.throws(() => validateChatRequest({ ...body, growth: 101 }));
  assert.throws(() =>
    validateChatRequest({
      ...body,
      messages: [{ speaker: "彪彪", text: "hi" }],
    }),
  );
});
test("single and @ chat reject switched identities, duplicates and bad proposals", () => {
  assert.throws(() =>
    validateChatResult(
      { replies: [{ speaker: "鲍比", text: "你好" }], proposals: [] },
      "小包",
    ),
  );
  assert.throws(() =>
    validateChatResult(
      { replies: [{ speaker: "鲍比", text: "你好" }], proposals: [] },
      "群聊",
      "@小包",
    ),
  );
  assert.throws(() =>
    validateChatResult({
      replies: [
        { speaker: "小包", text: "一样" },
        { speaker: "鲍比", text: "一样" },
      ],
      proposals: [],
    }),
  );
  assert.throws(() =>
    validateChatResult({
      replies: [{ speaker: "小包", text: "你好" }],
      proposals: [{ ...p, cents: -1 }],
    }),
  );
  assert.equal(
    validateChatResult({
      replies: [{ speaker: "小包", text: "先确认一下？" }],
      proposals: [p],
    }).proposals[0].cents,
    3500,
  );
});
test("growth requires slow confirmed interactions, never random jumps", () => {
  const now = Date.UTC(2026, 9, 13);
  const base = { id: "main", value: 0, events: [], updatedAt: 0 };
  assert.equal(grow(base, now).value, 1);
  assert.throws(() =>
    grow({ ...base, events: [{ at: now - 1000, text: "一起开玩笑" }] }, now),
  );
  assert.throws(() =>
    grow(
      {
        ...base,
        events: [
          { at: now - 2 * 86400000, text: "a" },
          { at: now - 4 * 86400000, text: "b" },
        ],
      },
      now,
    ),
  );
  assert.equal(grow({ ...base, value: 100 }, now).value, 100);
});
test("chat backups preserve independent memory and validate links, states and old backups", () => {
  assert.equal(validateChatBackup({ version: 1 }), null);
  const data = {
    chat: {
      threads: [{ id: "t", mode: "群聊", title: "hello", updatedAt: 1 }],
      messages: [
        {
          id: "m",
          threadId: "t",
          speaker: "小包",
          text: "确认一下",
          createdAt: 2,
          proposals: [{ ...p, id: "p", status: "pending" }],
        },
      ],
      memories: [
        {
          id: "mem",
          kind: "家庭小剧场",
          text: "鲍比和大家玩蛋糕侦探",
          updatedAt: 3,
        },
      ],
      growth: {
        id: "main",
        value: 1,
        updatedAt: 4,
        events: [{ at: 4, text: "慢慢学会玩笑" }],
      },
    },
  };
  assert.equal(validateChatBackup(data).messages.length, 1);
  assert.throws(() =>
    validateChatBackup({
      chat: {
        ...data.chat,
        messages: [{ ...data.chat.messages[0], threadId: "missing" }],
      },
    }),
  );
  assert.throws(() =>
    validateChatBackup({
      chat: { ...data.chat, growth: { ...data.chat.growth, value: 999 } },
    }),
  );
});
test("worker chat uses one structured request, fixed personalities and text only, checks modes", async () => {
  const env = {
    NUTRITION_API_KEY: "fixture",
    ACCESS_CODE: "fixture-access-code",
    AI_QUOTA: {
      idFromName: () => 1,
      get: () => ({ fetch: async () => Response.json({ allowed: true }) }),
    },
  };
  const make = (b) =>
    new Request("https://test/chat", {
      method: "POST",
      headers: {
        Origin: "https://hipjjj.github.io",
        "Content-Type": "application/json",
        "X-Access-Code": env.ACCESS_CODE,
      },
      body: JSON.stringify(b),
    });
  let calls = 0,
    posted;
  const fetchImpl = async (_, options) => {
    calls++;
    posted = JSON.parse(options.body);
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                replies: [
                  { speaker: "小包", text: "今天还行，鲍比没抢我的枕头。" },
                ],
                proposals: [],
              }),
            },
          ],
        },
      ],
    });
  };
  const response = await handle(make({ ...body, photos: ["private"] }), env, {
    fetchImpl,
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(posted.store, false);
  assert.equal(posted.text.format.name, "penguin_chat");
  assert.equal(posted.input[0].content.length, 1);
  assert.ok(!posted.input[0].content[0].text.includes("private"));
  assert.match(posted.instructions, /嘟嘟糕/);
  assert.match(posted.instructions, /不能变成第二个小包/);
  assert.match(posted.instructions, /不能声称已经记住/);
  assert.equal(
    (await handle(make({ ...body, mode: "陌生人" }), env, { fetchImpl }))
      .status,
    400,
  );
  assert.equal(calls, 1);
  assert.equal(
    (await handle(make({ ...body, mode: "鲍比" }), env, { fetchImpl })).status,
    502,
  );
});

test("generated dialogue cannot claim a local save without a confirmed card", () => {
  const missing = validateChatResult(
    {
      replies: [
        { speaker: "鲍比", text: "记好了！午饭35元，我已经帮你记账了。" },
      ],
      proposals: [],
    },
    "鲍比",
  );
  assert.match(missing.replies[0].text, /没有执行保存/);
  assert.match(missing.replies[0].text, /没有生成确认卡片/);
  const pending = validateChatResult(
    {
      replies: [{ speaker: "鲍比", text: "已经保存到钱柜啦！" }],
      proposals: [p],
    },
    "鲍比",
  );
  assert.match(pending.replies[0].text, /还没有保存/);
  assert.equal(pending.proposals[0].cents, 3500);
  const normal = validateChatResult(
    {
      replies: [
        { speaker: "鲍比", text: "啊？怎么又是我？我给你留了个位置。" },
      ],
      proposals: [],
    },
    "鲍比",
  );
  assert.match(normal.replies[0].text, /留了个位置/);
});

test("corrected group save claims remain distinct across repeated validation", () => {
  const result = validateChatResult({
    replies: [
      { speaker: "鲍比", text: "记好了！" },
      { speaker: "小包", text: "已经帮你保存了！" },
    ],
    proposals: [p],
  });
  assert.notEqual(result.replies[0].text, result.replies[1].text);
  assert.deepEqual(validateChatResult(result), result);
});

test("meal proposals validate portions and all four nutrients, preserve backup, reject empty and unsafe nutrition", () => {
  const food = {
    name: "熟米饭",
    grams: 150,
    per100: { kcal: 130, protein: 2.38, carbs: 28.59, fat: 0.21 },
    assumption: "按熟饭估算",
    confidence: "medium",
  };
  const meal = {
    ...p,
    kind: "饮食",
    text: "午饭",
    cents: 0,
    category: "",
    mealType: "午餐",
    foods: [food],
  };
  const result = validateChatResult(
    {
      replies: [{ speaker: "小包", text: "先核对一下份量吧。" }],
      proposals: [meal],
    },
    "小包",
  );
  assert.equal(result.proposals[0].foods[0].grams, 150);
  for (const bad of [
    { ...meal, foods: [] },
    { ...meal, mealType: "宵夜" },
    { ...meal, foods: [{ ...food, grams: -1 }] },
    { ...meal, foods: [{ ...food, per100: { ...food.per100, protein: -2 } }] },
  ])
    assert.throws(() =>
      validateChatResult({ replies: result.replies, proposals: [bad] }, "小包"),
    );
  const restored = validateChatBackup({
    chat: {
      threads: [{ id: "t", mode: "小包", title: "吃饭", updatedAt: 1 }],
      messages: [
        {
          id: "m",
          threadId: "t",
          speaker: "小包",
          text: "确认份量",
          createdAt: 2,
          proposals: [{ ...meal, id: "proposal", status: "pending" }],
        },
      ],
      memories: [],
      growth: null,
    },
  });
  assert.deepEqual(restored.messages[0].proposals[0].foods, [food]);
  assert.throws(() =>
    validateChatResult({
      replies: result.replies,
      proposals: [{ ...p, foods: [food] }],
    }),
  );
});
