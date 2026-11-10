import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAnswerKey,
  makePoints,
  validateGradingSettings,
  validateExamPhoto,
  validateExamRequest,
  validateExamRecognition,
  gradeExam,
  validateExamRecord,
  validateGradingBackup,
} from "../src/grading/model.mjs";
import { handle } from "../server/worker.mjs";
const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=";
const settings = () => ({
  id: "main",
  title: "测试卷",
  questionCount: 4,
  key: ["A", "B", "C", "D"],
  points: [0.1, 0.2, 3.5, 4],
  updatedAt: 1,
});
test("numbered or sequential standard answers are complete, bounded single-choice keys", () => {
  for (const key of [
    "A B C D",
    "1.A 2:B 3、C 4.D",
    "第1题A\n第2题B\n第3题C\n第4题D",
    "ＡＢＣＤ",
  ])
    assert.deepEqual(parseAnswerKey(key, 4), ["A", "B", "C", "D"]);
  for (const key of [
    "A B C",
    "1.A 1.B 3.C 4.D",
    "1.A 2.B 3.C 5.D",
    "1.A 2.B 3.C 4.D hello",
    "ABCDX",
  ])
    assert.throws(() => parseAnswerKey(key, 4));
});
test("per-question/range scores retain exact cents, reject conflicting or out-of-range rules", () => {
  assert.deepEqual(makePoints(5, 2, "1-2:0.5\n3:3.25"), [0.5, 0.5, 3.25, 2, 2]);
  assert.deepEqual(makePoints(3, 1, "1–3题：2分"), [2, 2, 2]);
  for (const rule of ["1-3:2\n2:3", "4:2", "3-1:1", "1:0", "1:1.234", "1 two"])
    assert.throws(() => makePoints(3, 1, rule));
  assert.throws(() => makePoints(2, NaN, ""));
});
test("missing, ambiguous and medium-confidence answers stay pending; clear blanks are wrong; manual confirmation resolves them", () => {
  const recognition = validateExamRecognition(
    {
      answers: [
        { number: 1, answer: "A", confidence: "high", note: "" },
        { number: 2, answer: "B", confidence: "medium", note: "涂改" },
        { number: 3, answer: "", confidence: "high", note: "空白" },
      ],
      note: "",
    },
    4,
  );
  let score = gradeExam(settings(), recognition.answers);
  assert.equal(score.pending, 2);
  assert.equal(score.earned, 0.1);
  assert.equal(score.total, 7.8);
  assert.equal(score.wrong, 1);
  assert.deepEqual(
    score.rows.map((x) => x.status),
    ["correct", "pending", "wrong", "pending"],
  );
  recognition.answers[1].confirmed = true;
  recognition.answers[3] = {
    ...recognition.answers[3],
    answer: "D",
    confirmed: true,
  };
  score = gradeExam(settings(), recognition.answers);
  assert.equal(score.pending, 0);
  assert.equal(score.earned, 4.3);
  assert.equal(score.correct, 3);
  assert.throws(() =>
    validateExamRecognition(
      {
        answers: [
          { number: 1, answer: "A", confidence: "high", note: "" },
          { number: 1, answer: "B", confidence: "high", note: "" },
        ],
        note: "",
      },
      4,
    ),
  );
  assert.throws(() =>
    validateExamRecognition(
      {
        answers: [{ number: 5, answer: "A", confidence: "high", note: "" }],
        note: "",
      },
      4,
    ),
  );
});
test("records keep settings snapshots, backup optional photos, and totals are always derived", () => {
  const config = settings(),
    answers = validateExamRecognition(
      {
        answers: config.key.map((answer, i) => ({
          number: i + 1,
          answer,
          confidence: "high",
          note: "",
        })),
        note: "",
      },
      4,
    ).answers;
  const record = validateExamRecord({
    id: "exam1",
    title: "卷一",
    settings: config,
    answers,
    note: "",
    photo,
    createdAt: 1,
    earned: 9999,
  });
  assert.equal(gradeExam(record.settings, record.answers).earned, 7.8);
  assert(!Object.hasOwn(record, "earned"));
  assert.equal(validateGradingBackup({}), null);
  assert.equal(
    validateGradingBackup({
      grading: { records: [record], settings: config, photosIncluded: true },
    }).records.length,
    1,
  );
  assert.throws(() =>
    validateGradingBackup({
      grading: {
        records: [record, record],
        settings: null,
        photosIncluded: true,
      },
    }),
  );
  config.key[0] = "D";
  assert.equal(record.settings.key[0], "A");
  assert.throws(() => validateExamPhoto("https://bad.test/paper.png"));
  assert.throws(() => validateExamPhoto("data:image/png;base64,YWJj"));
  assert.throws(() => validateGradingSettings({ ...settings(), points: [1] }));
});
const origin = "https://hipjjj.github.io";
const env = {
  NUTRITION_API_KEY: "fixture-key",
  ACCESS_CODE: "fixture-access-code",
  ALLOWED_ORIGINS: origin,
  AI_QUOTA: {
    idFromName: () => 1,
    get: () => ({ fetch: async () => Response.json({ allowed: true }) }),
  },
};
const request = (body) =>
  new Request("https://worker.test/grade-exam", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Access-Code": env.ACCESS_CODE,
    },
    body: JSON.stringify(body),
  });
test("exam endpoint isolates higher-quality model and high-detail vision; never forwards answer key, marks or unrelated records", async () => {
  let sent,
    calls = 0;
  const response = await handle(
    request({
      questionCount: 3,
      photo,
      key: "private-standard",
      points: [1, 2, 3],
      expenses: "private-ledger",
    }),
    env,
    {
      fetchImpl: async (_, options) => {
        calls++;
        sent = JSON.parse(options.body);
        return Response.json({
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    answers: [
                      { number: 1, answer: "B", confidence: "high", note: "" },
                      { number: 3, answer: "D", confidence: "high", note: "" },
                    ],
                    note: "第二题不清楚",
                  }),
                },
              ],
            },
          ],
        });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(sent.model, "gpt-5");
  assert.equal(sent.store, false);
  assert.equal(sent.input[0].content[1].detail, "high");
  assert.equal(sent.text.format.name, "exam_answers");
  assert(!JSON.stringify(sent).includes("private-"));
  assert.equal(calls, 1);
  const data = await response.json();
  assert.equal(data.model, "gpt-5");
  assert.equal(data.answers[1].answer, "?");
  assert.equal(data.answers[1].number, 2);
});
test("invalid exam images/counts are rejected before quota or provider calls; large photo limits stay isolated", async () => {
  let quota = 0,
    calls = 0;
  const config = {
    ...env,
    AI_QUOTA: {
      idFromName: () => 1,
      get: () => ({
        fetch: async () => {
          quota++;
          return Response.json({ allowed: true });
        },
      }),
    },
  };
  const fetchImpl = async () => {
    calls++;
    return Response.json({}, { status: 503 });
  };
  for (const body of [
    { photo, questionCount: 0 },
    { photo: "https://bad.test", questionCount: 3 },
    { photo, questionCount: 101 },
    { photo: "data:image/png;base64," + "A".repeat(2800000), questionCount: 3 },
  ])
    assert.equal(
      (await handle(request(body), config, { fetchImpl })).status,
      400,
    );
  assert.equal(quota, 0);
  assert.equal(calls, 0);
  assert.equal(
    validateExamRequest({ photo, questionCount: 1, key: "private" }).key,
    undefined,
  );
});

test("exam body accepts a high-resolution payload above the nutrition limit without widening other endpoints", async () => {
  const bytes = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(710000),
    ]),
    large = "data:image/png;base64," + bytes.toString("base64");
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ answers: [], note: "请核对" }),
            },
          ],
        },
      ],
    });
  };
  const response = await handle(
    request({ questionCount: 1, photo: large }),
    env,
    { fetchImpl },
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  const nutrition = new Request("https://worker.test/analyze", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Access-Code": env.ACCESS_CODE,
    },
    body: JSON.stringify({ text: "食物", photo: large }),
  });
  assert.equal((await handle(nutrition, env, { fetchImpl })).status, 413);
  assert.equal(calls, 1);
});
